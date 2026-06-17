"""
woori-vault/복지정책/ 폴더의 마크다운 문서들을 RAG에 임베딩하는 스크립트.
백엔드 서버가 실행 중인 상태에서 실행해야 한다.

사용법:
  python embed_welfare_docs.py
  python embed_welfare_docs.py --url http://localhost:8000
  python embed_welfare_docs.py --file 당뇨병_관련복지.md  (특정 파일만)
  python embed_welfare_docs.py --delete  (기존 문서 삭제 후 재임베딩)
"""

import argparse
import json
import sys
from pathlib import Path

import requests

VAULT_DIR = Path(__file__).parent.parent / "woori-vault" / "복지정책"
DEFAULT_URL = "http://localhost:8000"
EMBED_ENDPOINT = "/api/rag-documents/embed-document"
DELETE_ENDPOINT = "/api/rag-documents/delete-documents"
COUNT_ENDPOINT = "/api/rag-documents/count-by-document-id"


def make_document_id(filename: str) -> str:
    stem = Path(filename).stem
    return f"obsidian_{stem}"


def embed_file(base_url: str, md_path: Path, delete_first: bool = False) -> dict:
    document_id = make_document_id(md_path.name)
    content = md_path.read_text(encoding="utf-8")

    title = md_path.stem.replace("_", " ")
    for line in content.splitlines():
        if line.startswith("title:"):
            title = line.replace("title:", "").strip()
            break

    if delete_first:
        resp = requests.post(
            f"{base_url}{DELETE_ENDPOINT}",
            json={"document_ids": [document_id]},
            timeout=30,
        )
        if resp.status_code == 200:
            deleted = resp.json().get("deleted_chunk_count", 0)
            print(f"  삭제: {document_id} ({deleted}개 청크 제거)")
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

    if not VAULT_DIR.exists():
        print(f"문서 폴더가 없습니다: {VAULT_DIR}")
        sys.exit(1)

    if args.file:
        files = [VAULT_DIR / args.file]
        if not files[0].exists():
            print(f"파일을 찾을 수 없습니다: {files[0]}")
            sys.exit(1)
    else:
        files = sorted(VAULT_DIR.glob("*.md"))

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
