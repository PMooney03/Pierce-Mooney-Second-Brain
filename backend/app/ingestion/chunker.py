"""Structure-aware text chunking."""

from __future__ import annotations

from app.database.models import ChunkData, ExtractedBlock, ExtractedDocument


def _approx_tokens(text: str) -> int:
    """Rough token estimate (~4 characters per token)."""
    return max(1, len(text) // 4)


class DocumentChunker:
    """Chunk extracted documents by structure, targeting a token budget."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = min(chunk_overlap, chunk_size // 2)

    def chunk(self, document: ExtractedDocument) -> list[ChunkData]:
        blocks = document.blocks
        if not blocks:
            return []

        chunks: list[ChunkData] = []
        buffer_parts: list[str] = []
        buffer_pages: list[int] = []
        current_heading: str | None = None
        buffer_tokens = 0

        def flush() -> None:
            nonlocal buffer_parts, buffer_pages, buffer_tokens
            if not buffer_parts:
                return
            text = "\n\n".join(buffer_parts).strip()
            if not text:
                buffer_parts, buffer_pages, buffer_tokens = [], [], 0
                return
            pages = [p for p in buffer_pages if p is not None]
            chunks.append(
                ChunkData(
                    text=text,
                    chunk_index=len(chunks),
                    page_start=min(pages) if pages else None,
                    page_end=max(pages) if pages else None,
                    heading=current_heading,
                )
            )
            # Overlap: keep tail of buffer
            if self.chunk_overlap > 0 and buffer_parts:
                overlap_parts: list[str] = []
                overlap_tokens = 0
                for part in reversed(buffer_parts):
                    t = _approx_tokens(part)
                    if overlap_parts and overlap_tokens + t > self.chunk_overlap:
                        break
                    overlap_parts.insert(0, part)
                    overlap_tokens += t
                buffer_parts = overlap_parts
                buffer_tokens = overlap_tokens
                # Keep last page for overlap context
                if buffer_pages:
                    buffer_pages = [buffer_pages[-1]]
                else:
                    buffer_pages = []
            else:
                buffer_parts, buffer_pages, buffer_tokens = [], [], 0

        for block in blocks:
            if block.block_type == "heading":
                # Start new chunk at heading boundaries when buffer has content
                if buffer_parts and buffer_tokens >= self.chunk_size // 4:
                    flush()
                current_heading = block.text
                # Include heading text in the next chunk
                part = block.text
            else:
                part = block.text
                if block.heading:
                    current_heading = block.heading

            part_tokens = _approx_tokens(part)

            # Oversized single block: hard-split by paragraphs/sentences
            if part_tokens > self.chunk_size:
                if buffer_parts:
                    flush()
                for piece in self._split_long(part):
                    buffer_parts.append(piece)
                    if block.page is not None:
                        buffer_pages.append(block.page)
                    buffer_tokens = _approx_tokens("\n\n".join(buffer_parts))
                    if buffer_tokens >= self.chunk_size:
                        flush()
                continue

            if buffer_tokens + part_tokens > self.chunk_size and buffer_parts:
                flush()

            buffer_parts.append(part)
            if block.page is not None:
                buffer_pages.append(block.page)
            buffer_tokens += part_tokens

        flush()

        # Re-index after flush overlap quirks
        for i, c in enumerate(chunks):
            c.chunk_index = i
            # Hard cap characters so embeddings stay within model context.
            # Dense PDF text can exceed token limits sooner than ~4 chars/token.
            max_chars = min(self.chunk_size * 3, 2400)
            if len(c.text) > max_chars:
                c.text = c.text[:max_chars]
        return chunks

    def _split_long(self, text: str) -> list[str]:
        """Split oversized text on paragraph then sentence boundaries."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if len(paragraphs) <= 1:
            paragraphs = [s.strip() for s in text.replace("\n", " ").split(". ") if s.strip()]
            paragraphs = [p if p.endswith(".") else p + "." for p in paragraphs]

        pieces: list[str] = []
        buf: list[str] = []
        tokens = 0
        for para in paragraphs:
            t = _approx_tokens(para)
            if tokens + t > self.chunk_size and buf:
                pieces.append("\n\n".join(buf))
                buf = []
                tokens = 0
            if t > self.chunk_size:
                # Character window as last resort
                step = self.chunk_size * 4
                for i in range(0, len(para), step):
                    pieces.append(para[i : i + step])
                continue
            buf.append(para)
            tokens += t
        if buf:
            pieces.append("\n\n".join(buf))
        return pieces
