package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.dto.SeniorLoginRequest;
import com.nuri.woorilink.dto.SeniorRegisterRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class SeniorAuthService {

    private final SeniorRepository seniorRepository;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(SeniorLoginRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(request.getName())) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }

        Senior senior = seniorRepository.findFirstByPhoneAndName(phone, request.getName())
                .orElseThrow(() -> new IllegalArgumentException("일치하는 사용자 계정이 없습니다."));

        String token = tokenProvider.generateToken(senior.getPhone(), "SENIOR", senior.getId());
        return new LoginResponse(token, "SENIOR", senior.getId(), senior.getName());
    }

    @Transactional
    public void register(SeniorRegisterRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }
        if (seniorRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }

        seniorRepository.save(Senior.builder()
                .name(request.getName())
                .phone(phone)
                .age(request.getAge())
                .address(request.getAddress())
                .gender(request.getGender())
                .guardianId(request.getGuardianId())
                .build());
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }
}
