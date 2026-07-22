package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.dto.SeniorLoginRequest;
import com.nuri.woorilink.dto.SeniorRegisterRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.Guardian;
import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class SeniorAuthService {

    private final SeniorRepository seniorRepository;
    private final GuardianRepository guardianRepository;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(SeniorLoginRequest request) {
        String phone = normalizePhone(request.getPhone());

        if (!StringUtils.hasText(request.getName())) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }

        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }

        Senior senior = seniorRepository
                .findFirstByPhoneAndName(phone, request.getName())
                .orElseThrow(() ->
                        new IllegalArgumentException("일치하는 사용자 계정이 없습니다."));

        String token = tokenProvider.generateToken(
                senior.getPhone(),
                "SENIOR",
                senior.getId()
        );

        return new LoginResponse(
                token,
                "SENIOR",
                senior.getId(),
                senior.getName()
        );
    }

    @Transactional
    public void register(SeniorRegisterRequest request) {
        String phone = normalizePhone(request.getPhone());

        if (!StringUtils.hasText(request.getName())) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }

        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }

        if (seniorRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }

        String inviteCode = normalizeInviteCode(request.getInviteCode());
        if (!StringUtils.hasText(inviteCode)) {
            throw new IllegalArgumentException("보호자 초대 코드를 입력해 주세요.");
        }

        Guardian guardian = guardianRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 초대 코드입니다."));

        Senior senior = Senior.builder()
                .name(request.getName())
                .phone(phone)
                .birthDate(request.getBirthDate())
                .address(request.getAddress())
                .gender(request.getGender())
                .guardianId(guardian.getId())
                .build();

        seniorRepository.save(senior);
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }

    private String normalizeInviteCode(String inviteCode) {
        return inviteCode == null
                ? null
                : inviteCode.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }
}
