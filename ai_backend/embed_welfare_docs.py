"""
woori-vault의 복지·요금감면·제품안전 문서를 RAG에 임베딩하는 스크립트.
백엔드 서버가 실행 중인 상태에서 실행해야 한다.

사용법:
  python embed_welfare_docs.py
  python embed_welfare_docs.py --url http://localhost:8001
  python embed_welfare_docs.py --file 당뇨병_관련복지.md  (특정 파일만)
  python embed_welfare_docs.py --delete  (기존 문서 삭제 후 재임베딩)
"""

import argparse
import json
import re
import sys
from pathlib import Path

import requests

VAULT_ROOT = Path(__file__).parent.parent / "woori-vault"
DOCUMENT_DIRS = [
    VAULT_ROOT / "복지정책",
    VAULT_ROOT / "welfare",
    VAULT_ROOT / "utility-discount",
    VAULT_ROOT / "product-safety",
]
DEFAULT_URL = "http://localhost:8001"
EMBED_ENDPOINT = "/api/rag-documents/embed-document"
DELETE_ENDPOINT = "/api/rag-documents/delete-documents"
COUNT_ENDPOINT = "/api/rag-documents/count-by-document-id"


def make_document_id(md_path: Path, metadata: dict) -> str:
    configured_id = str(metadata.get("document_id") or "").strip()
    if configured_id:
        return configured_id

    relative_stem = md_path.relative_to(VAULT_ROOT).with_suffix("").as_posix()
    normalized = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", relative_stem.replace("/", "_"))
    return f"obsidian_{normalized.strip('_')}"


def parse_frontmatter(content: str) -> dict:
    if not content.startswith("---"):
        return {}

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}

    metadata = {}
    lines = parts[1].splitlines()
    for index, line in enumerate(lines):
        if ":" not in line or line.startswith(" "):
            continue
        key, value = line.split(":", 1)
        value = value.strip().strip('"').strip("'")
        if value:
            metadata[key.strip()] = value
        elif key.strip() in {"source_names", "source_urls"}:
            for child in lines[index + 1:]:
                if not child.startswith("  -"):
                    break
                first_value = child.split("-", 1)[1].strip().strip('"').strip("'")
                target_key = "authority" if key.strip() == "source_names" else "source_url"
                metadata[target_key] = first_value
                break

    if not metadata.get("effective_year"):
        year_match = re.search(r"\b(20\d{2})년\b", parts[1])
        if year_match:
            metadata["effective_year"] = year_match.group(1)

    return metadata


def embed_file(base_url: str, md_path: Path, delete_first: bool = False) -> dict:
    content = md_path.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(content)
    document_id = make_document_id(md_path, frontmatter)

    title = frontmatter.get("title") or md_path.stem.replace("_", " ")
    for line in content.splitlines():
        if line.startswith("title:"):
            title = line.replace("title:", "").strip()
            break

    if delete_first:
        legacy_document_id = f"obsidian_{md_path.stem}"
        delete_ids = list(dict.fromkeys([document_id, legacy_document_id]))
        resp = requests.post(
            f"{base_url}{DELETE_ENDPOINT}",
            json={"document_ids": delete_ids},
            timeout=30,
        )
        if resp.status_code == 200:
            deleted = resp.json().get("deleted_chunk_count", 0)
            print(f"  삭제: {', '.join(delete_ids)} ({deleted}개 청크 제거)")
        else:
            print(f"  삭제 실패 ({resp.status_code}): {resp.text[:100]}")

    resp = requests.post(
        f"{base_url}{EMBED_ENDPOINT}",
        json={
            "document_id": document_id,
            "title": title,
            "filename": md_path.name,
            "source_type": "obsidian_md",
            "source": "woori-vault",
            "content": content,
            "authority": frontmatter.get("authority"),
            "effective_year": int(frontmatter["effective_year"]) if str(frontmatter.get("effective_year", "")).isdigit() else None,
            "source_url": frontmatter.get("source_url"),
        },
        timeout=300,
    )

    result = resp.json() if resp.status_code == 200 else {"error": resp.text}
    return {"file": md_path.name, "document_id": document_id, **result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL, help="백엔드 URL")
    parser.add_argument("--file", default=None, help="특정 파일 이름만 임베딩")
    parser.add_argument("--delete", action="store_true", help="기존 임베딩 삭제 후 재임베딩")
    args = parser.parse_args()

    base_url = args.url.rstrip("/")

    try:
        health = requests.get(f"{base_url}/health", timeout=5)
        print(f"백엔드 연결 확인: {health.json()}\n")
    except Exception as e:
        print(f"백엔드에 연결할 수 없습니다: {e}")
        print(f"서버가 {base_url} 에서 실행 중인지 확인하세요.")
        sys.exit(1)

    existing_dirs = [directory for directory in DOCUMENT_DIRS if directory.exists()]
    if not existing_dirs:
        print(f"문서 폴더가 없습니다: {VAULT_ROOT}")
        sys.exit(1)

    if args.file:
        requested = Path(args.file)
        direct_path = VAULT_ROOT / requested
        if direct_path.is_file():
            files = [direct_path]
        else:
            files = [
                path
                for directory in existing_dirs
                for path in directory.rglob(requested.name)
                if path.is_file()
            ]
        if not files:
            print(f"파일을 찾을 수 없습니다: {args.file}")
            sys.exit(1)
    else:
        files = sorted({
            path
            for directory in existing_dirs
            for path in directory.rglob("*.md")
        })

    print(f"대상 문서: {len(files)}개\n")

    success, skipped, failed = 0, 0, 0

    for md_path in files:
        print(f"[{md_path.name}]")
        result = embed_file(base_url, md_path, delete_first=args.delete)

        status = result.get("status", "")
        if "error" in result:
            print(f"  실패: {result['error'][:150]}")
            failed += 1
        elif status == "SKIPPED_EXISTS":
            print(f"  스킵 (이미 존재, {result.get('existing_chunks')}개 청크) → 재임베딩하려면 --delete 옵션 사용")
            skipped += 1
        elif status == "EMBEDDED":
            print(f"  완료: {result.get('saved_chunks')}개 청크 저장 ({result.get('document_id')})")
            success += 1
        else:
            print(f"  알 수 없는 상태: {json.dumps(result, ensure_ascii=False)[:200]}")
            failed += 1

    print(f"\n완료: 성공 {success}개 / 스킵 {skipped}개 / 실패 {failed}개")


if __name__ == "__main__":
    main()
