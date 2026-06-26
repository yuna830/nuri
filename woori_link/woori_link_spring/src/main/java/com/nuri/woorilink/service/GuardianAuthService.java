package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.dto.GuardianLoginRequest;
import com.nuri.woorilink.dto.GuardianRegisterRequest;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.entity.Guardian;
import com.nuri.woorilink.repository.GuardianRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class GuardianAuthService {

    private final GuardianRepository guardianRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(GuardianLoginRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new IllegalArgumentException("비밀번호를 입력해주세요.");
        }

        Guardian guardian = guardianRepository.findFirstByPhone(phone)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 보호자 계정입니다."));

        if (!passwordEncoder.matches(request.getPassword(), guardian.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }

        String token = tokenProvider.generateToken(guardian.getPhone(), "GUARDIAN", guardian.getId());
        return new LoginResponse(token, "GUARDIAN", guardian.getId(), guardian.getName());
    }

    @Transactional
    public void register(GuardianRegisterRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new IllegalArgumentException("비밀번호를 입력해주세요.");
        }
        if (guardianRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }

        guardianRepository.save(Guardian.builder()
                .name(request.getName())
                .phone(phone)
                .password(passwordEncoder.encode(request.getPassword()))
                .relationship(request.getRelationship())
                .email(request.getEmail())
                .build());
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }
}
