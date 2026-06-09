package com.nuri.woori.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
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
            throw new IllegalArgumentException("No upload file was provided.");
        }

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
