import fitz


class PdfService:
    def extract_text(self, file_bytes: bytes) -> str:
        document = fitz.open(stream=file_bytes, filetype="pdf")

        pages = []
        for page_index, page in enumerate(document, start=1):
            text = page.get_text("text").strip()

            if text:
                pages.append(f"[페이지 {page_index}]\n{text}")

        return "\n\n".join(pages)

    def chunk_text(
        self,
        text: str,
        chunk_size: int = 3000,
        chunk_overlap: int = 300,
    ) -> list[str]:
        normalized_text = " ".join(text.split())

        if not normalized_text:
            return []

        chunks = []
        start = 0

        while start < len(normalized_text):
            end = min(start + chunk_size, len(normalized_text))
            chunk = normalized_text[start:end].strip()

            if chunk:
                chunks.append(chunk)

            if end >= len(normalized_text):
                break

            start = max(0, end - chunk_overlap)

        return chunks