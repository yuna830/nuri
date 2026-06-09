package com.nuri.woori.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
public class FileUploadController {

    private final Path uploadRoot;

    public FileUploadController(@Value("${app.upload-root:uploads}") String uploadRoot) {
        this.uploadRoot = Paths.get(uploadRoot).toAbsolutePath().normalize();
    }

    @PostMapping("/{category}")
    public ResponseEntity<Map<String, String>> uploadImage(
            @PathVariable String category,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "file", required = false) MultipartFile file
    ) throws Exception {
        MultipartFile uploadFile = image != null ? image : file;

        if (uploadFile == null || uploadFile.isEmpty()) {
            throw new IllegalArgumentException("업로드할 파일이 없습니다.");
        }

        // 프로필 사진은 Base64 data URL로 반환 → DB에 저장 → 팀원 간 공유 가능
        if ("profile".equals(category)) {
            String contentType = uploadFile.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                contentType = "image/jpeg";
            }
            String base64 = Base64.getEncoder().encodeToString(uploadFile.getBytes());
            String dataUrl = "data:" + contentType + ";base64," + base64;
            String originalName = uploadFile.getOriginalFilename();
            return ResponseEntity.ok(Map.of(
                    "imageUrl", dataUrl,
                    "fileUrl", dataUrl,
                    "fileName", originalName != null ? originalName : ""
            ));
        }

        // 그 외 카테고리(chat, missing-reports 등)는 기존대로 파일 시스템에 저장
        String originalFilename = uploadFile.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String savedFilename = UUID.randomUUID() + extension;

        Path categoryPath = uploadRoot.resolve(category).normalize();
        Files.createDirectories(categoryPath);

        Path savedPath = categoryPath.resolve(savedFilename).normalize();
        uploadFile.transferTo(savedPath.toFile());

        String fileUrl = "/uploads/" + category + "/" + savedFilename;

        return ResponseEntity.ok(Map.of(
                "imageUrl", fileUrl,
                "fileUrl", fileUrl,
                "fileName", originalFilename == null ? savedFilename : originalFilename
        ));
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".bin";
        }

        return filename.substring(filename.lastIndexOf("."));
    }
}
