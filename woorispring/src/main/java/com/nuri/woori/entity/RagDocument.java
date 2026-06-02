package com.nuri.woori.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "rag_documents")
public class RagDocument {

    @Id
    @Column(name = "document_id", length = 255)
    private String documentId;

    @Column(name = "filename", length = 500)
    private String filename;

    @Column(name = "title", length = 500)
    private String title;

    @Column(name = "source", length = 500)
    private String source;

    @Column(name = "status", length = 100)
    private String status;

    @Column(name = "qdrant_collection", length = 255)
    private String qdrantCollection;

    @Column(name = "text_length")
    private Integer textLength;

    @Column(name = "chunk_count")
    private Integer chunkCount;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "raw_hash", length = 64)
    private String rawHash;

    @Column(name = "source_type", length = 100)
    private String sourceType;

    @Column(name = "source_id", length = 100)
    private String sourceId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getQdrantCollection() {
        return qdrantCollection;
    }

    public void setQdrantCollection(String qdrantCollection) {
        this.qdrantCollection = qdrantCollection;
    }

    public Integer getTextLength() {
        return textLength;
    }

    public void setTextLength(Integer textLength) {
        this.textLength = textLength;
    }

    public Integer getChunkCount() {
        return chunkCount;
    }

    public void setChunkCount(Integer chunkCount) {
        this.chunkCount = chunkCount;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getRawHash() {
        return rawHash;
    }

    public void setRawHash(String rawHash) {
        this.rawHash = rawHash;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}