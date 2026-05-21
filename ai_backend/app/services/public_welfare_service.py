import xml.etree.ElementTree as ET
from uuid import uuid4

import httpx
import math

from app.core.config import settings
from app.services.embedding_cache_service import EmbeddingCacheService
from app.services.embedding_service import EmbeddingService
from app.services.metadata_service import MetadataService
from app.services.pdf_service import PdfService
from app.services.qdrant_service import QdrantService


class PublicWelfareService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.cache_service = EmbeddingCacheService()
        self.qdrant_service = QdrantService()
        self.metadata_service = MetadataService()
        self.pdf_service = PdfService()

    def sync(
        self,
        start_page: int = 1,
        max_pages: int = 1,
        num_of_rows: int = 10,
        limit_items: int = 5,
    ) -> dict:
        saved_documents = 0
        saved_chunks = 0
        processed_items = 0

        end_page = start_page + max_pages

        for page_no in range(start_page, end_page):
            list_xml = self._request_xml(
                settings.public_welfare_list_url
                .replace("{serviceKey}", settings.public_welfare_service_key)
                .replace("{pageNo}", str(page_no))
                .replace("{numOfRows}", str(num_of_rows))
            )

            items = self._parse_list_items(list_xml)

            if not items:
                break

            for item in items:
                if processed_items >= limit_items:
                    return {
                        "saved_documents": saved_documents,
                        "saved_chunks": saved_chunks,
                        "processed_items": processed_items,
                    }

                document_id = str(uuid4())
                detail_xml = ""

                if item["service_id"]:
                    detail_xml = self._request_xml(
                        settings.public_welfare_detail_url
                        .replace("{serviceKey}", settings.public_welfare_service_key)
                        .replace("{serviceId}", item["service_id"])
                    )

                content = self._build_content(item, detail_xml)
                chunks = self.pdf_service.chunk_text(content)

                vectors = self._embed_chunks(chunks)

                saved_count = self.qdrant_service.save_chunks(
                    document_id=document_id,
                    chunks=chunks,
                    vectors=vectors,
                    source_type="public_api",
                    metadata={
                        "service_id": item["service_id"],
                        "service_name": item["title"],
                        "region": item["region"],
                        "department": item["department"],
                        "source": "data.go.kr",
                    },
                )

                self.metadata_service.create_document(
                    document_id=document_id,
                    filename=item["title"] or item["service_id"] or "public_welfare",
                    title=item["title"],
                    source="data.go.kr",
                    status="completed",
                    qdrant_collection=settings.qdrant_collection,
                )

                self.metadata_service.update_document_result(
                    document_id=document_id,
                    status="completed",
                    text_length=len(content),
                    chunk_count=len(chunks),
                )

                saved_documents += 1
                saved_chunks += saved_count
                processed_items += 1

        return {
            "saved_documents": saved_documents,
            "saved_chunks": saved_chunks,
            "processed_items": processed_items,
        }

    def _embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        vectors: list[list[float] | None] = []
        missing_chunks = []
        missing_indexes = []

        for index, chunk in enumerate(chunks):
            cached_vector = self.cache_service.get(chunk)

            if cached_vector is not None:
                vectors.append(cached_vector)
            else:
                vectors.append(None)
                missing_chunks.append(chunk)
                missing_indexes.append(index)

        if missing_chunks:
            embedded_vectors = self.embedding_service.embed_texts(missing_chunks)

            for chunk, index, vector in zip(missing_chunks, missing_indexes, embedded_vectors):
                self.cache_service.set(chunk, vector)
                vectors[index] = vector

        return [vector for vector in vectors if vector is not None]

    def _request_xml(self, url: str) -> str:
        response = httpx.get(url, timeout=30)
        response.raise_for_status()
        return response.text

    def _parse_list_items(self, xml_text: str) -> list[dict]:
        root = ET.fromstring(xml_text)
        elements = root.findall(".//servList") or root.findall(".//item") or root.findall(".//data")

        items = []

        for element in elements:
            items.append({
                "service_id": self._first_text(element, ["servId", "serviceId", "svcId", "bizId", "id"]),
                "title": self._first_text(element, ["servNm", "serviceName", "svcNm", "title"]),
                "region": self._join_region(
                    self._first_text(element, ["ctpvNm", "region"]),
                    self._first_text(element, ["sggNm"]),
                ),
                "summary": self._first_text(element, ["servDgst", "summary", "description"]),
                "apply_method": self._first_text(element, ["aplyMtdNm"]),
                "department": self._first_text(element, ["bizChrDeptNm"]),
                "life_cycle": self._first_text(element, ["lifeNmArray"]),
                "target": self._first_text(element, ["trgterIndvdlNmArray"]),
                "theme": self._first_text(element, ["intrsThemaNmArray"]),
                "provision": self._first_text(element, ["srvPvsnNm"]),
                "detail_link": self._first_text(element, ["servDtlLink"]),
            })

        return [
            item for item in items
            if item["service_id"] or item["title"]
        ]

    def _build_content(self, item: dict, detail_xml: str) -> str:
        detail_root = ET.fromstring(detail_xml) if detail_xml else None

        lines = [
            ("서비스명", item["title"]),
            ("지역", item["region"]),
            ("생활주기", item["life_cycle"]),
            ("대상자 특성", item["target"]),
            ("관심 주제", item["theme"]),
            ("제공 형태", item["provision"]),
            ("담당 부서", item["department"]),
            ("지원 대상", self._first_text(detail_root, ["tgtrDtlCn", "supportTarget", "trgterIndvdl"])),
            ("선정 기준", self._first_text(detail_root, ["slctCritCn", "selectionCriteria"])),
            ("지원 내용", self._first_text(detail_root, ["alwServCn", "servDgst", "supportContent"]) or item["summary"]),
            ("신청 방법", self._first_text(detail_root, ["aplyMtdCn", "applicationMethod"]) or item["apply_method"]),
            ("문의처", self._first_text(detail_root, ["inqNum", "contact"])),
            ("상세 링크", item["detail_link"]),
        ]

        return "\n".join(
            f"{label}: {value}"
            for label, value in lines
            if value
        )

    def _first_text(self, element, tag_names: list[str]) -> str:
        if element is None:
            return ""

        for tag_name in tag_names:
            found = element.find(f".//{tag_name}")

            if found is not None and found.text and found.text.strip():
                return found.text.strip()

        return ""

    def _join_region(self, region: str, district: str) -> str:
        if region and district:
            return f"{region} {district}"

        return region or district or ""
    
    def get_page_info(self, num_of_rows: int = 10) -> dict:
        list_xml = self._request_xml(
            settings.public_welfare_list_url
            .replace("{serviceKey}", settings.public_welfare_service_key)
            .replace("{pageNo}", "1")
            .replace("{numOfRows}", str(num_of_rows))
        )

        root = ET.fromstring(list_xml)

        total_count = self._first_int(root, ["totalCount", "totalCnt", "total"])
        page_no = self._first_int(root, ["pageNo", "pageIndex"]) or 1

        total_pages = math.ceil(total_count / num_of_rows) if total_count > 0 else 0

        return {
            "total_count": total_count,
            "num_of_rows": num_of_rows,
            "current_page": page_no,
            "total_pages": total_pages,
        }

    def _first_int(self, element, tag_names: list[str]) -> int:
        text_value = self._first_text(element, tag_names)

        if not text_value:
            return 0

        try:
            return int(text_value)
        except ValueError:
            return 0

    # page 단위 메서드 추가    
    def sync_page(self, page_no: int, num_of_rows: int = 10) -> dict:
        return self.sync(
            start_page=page_no,
            max_pages=1,
            num_of_rows=num_of_rows,
            limit_items=num_of_rows,
        )