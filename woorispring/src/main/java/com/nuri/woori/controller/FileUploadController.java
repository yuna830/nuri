package com.nuri.woori.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
public class FileUploadController {

    private final Path uploadRoot = Paths.get("uploads").toAbsolutePath().normalize();

    @PostMapping("/{category}")
    public ResponseEntity<Map<String, String>> uploadImage(
            @PathVariable String category,
            @RequestParam("image") MultipartFile image
    ) throws Exception {
        if (image.isEmpty()) {
            throw new IllegalArgumentException("업로드할 이미지가 없습니다.");
        }

        String originalFilename = image.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String savedFilename = UUID.randomUUID() + extension;

        Path categoryPath = uploadRoot.resolve(category).normalize();
        Files.createDirectories(categoryPath);

        Path savedPath = categoryPath.resolve(savedFilename).normalize();
        image.transferTo(savedPath.toFile());

        String imageUrl = "/uploads/" + category + "/" + savedFilename;

        return ResponseEntity.ok(Map.of("imageUrl", imageUrl));
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".jpg";
        }

        return filename.substring(filename.lastIndexOf("."));
    }
}
