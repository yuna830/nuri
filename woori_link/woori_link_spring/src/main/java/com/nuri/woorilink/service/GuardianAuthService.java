package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.dto.GuardianLoginRequest;
import com.nuri.woorilink.dto.GuardianRegisterRequest;
import com.nuri.woorilink.dto.GuardianRegisterResponse;
import com.nuri.woorilink.dto.GuardianProfileRequest;
import com.nuri.woorilink.dto.GuardianProfileResponse;
import com.nuri.woorilink.dto.GuardianPasswordResetRequest;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.entity.Guardian;
import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.dto.GuardianNotificationSettingsRequest;
import com.nuri.woorilink.dto.GuardianPasswordChangeRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class GuardianAuthService {

    private static final String INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private final SecureRandom secureRandom = new SecureRandom();

    private final GuardianRepository guardianRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final SeniorRepository seniorRepository;

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
    public GuardianRegisterResponse register(GuardianRegisterRequest request) {
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

        Guardian guardian = guardianRepository.save(Guardian.builder()
                .name(request.getName())
                .phone(phone)
                .password(passwordEncoder.encode(request.getPassword()))
                .relationship(request.getRelationship())
                .email(request.getEmail())
                .inviteCode(generateUniqueInviteCode())
                .inviteCodeExpiresAt(LocalDateTime.now().plusDays(7))
                .build());

        return new GuardianRegisterResponse(guardian.getId(), guardian.getInviteCode());
    }

    @Transactional
    public void resetPassword(GuardianPasswordResetRequest request) {
        String phone = normalizePhone(request.getPhone());

        if (!StringUtils.hasText(request.getName())) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("전화번호를 입력해주세요.");
        }
        if (!StringUtils.hasText(request.getNewPassword())) {
            throw new IllegalArgumentException("새 비밀번호를 입력해주세요.");
        }

        Guardian guardian = guardianRepository.findFirstByPhoneAndName(phone, request.getName())
                .orElseThrow(() -> new IllegalArgumentException("일치하는 보호자 계정이 없습니다."));

        guardian.setPassword(passwordEncoder.encode(request.getNewPassword()));
    }

    public GuardianProfileResponse getProfile(Long guardianId) {
        return GuardianProfileResponse.from(findGuardian(guardianId));
    }

    @Transactional
    public GuardianProfileResponse updateProfile(Long guardianId, GuardianProfileRequest request) {
        Guardian guardian = findGuardian(guardianId);
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(request.getName()) || !StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("이름과 전화번호를 입력해 주세요.");
        }
        guardianRepository.findFirstByPhone(phone)
                .filter(existing -> !existing.getId().equals(guardianId))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
                });
        guardian.setName(request.getName().trim());
        guardian.setPhone(phone);
        guardian.setEmail(request.getEmail());
        guardian.setAddress(request.getAddress());
        return GuardianProfileResponse.from(guardian);
    }

    @Transactional
    public GuardianProfileResponse regenerateInviteCode(Long guardianId) {
        Guardian guardian = findGuardian(guardianId);
        guardian.setInviteCode(generateUniqueInviteCode());
        guardian.setInviteCodeExpiresAt(LocalDateTime.now().plusDays(7));
        return GuardianProfileResponse.from(guardian);
    }

    @Transactional
    public GuardianProfileResponse updateNotificationSettings(
            Long guardianId, GuardianNotificationSettingsRequest request) {
        Guardian guardian = findGuardian(guardianId);
        guardian.setCheckInAlertEnabled(request.getCheckInAlertEnabled());
        guardian.setFallAlertEnabled(request.getFallAlertEnabled());
        guardian.setSafetyZoneAlertEnabled(request.getSafetyZoneAlertEnabled());
        guardian.setRecallAlertEnabled(request.getRecallAlertEnabled());
        guardian.setWeatherAlertEnabled(request.getWeatherAlertEnabled());
        guardian.setWelfareAlertEnabled(request.getWelfareAlertEnabled());
        guardian.setAppNotificationEnabled(request.getAppNotificationEnabled());
        guardian.setWebNotificationEnabled(request.getWebNotificationEnabled());
        return GuardianProfileResponse.from(guardian);
    }

    @Transactional
    public void changePassword(Long guardianId, GuardianPasswordChangeRequest request) {
        Guardian guardian = findGuardian(guardianId);
        if (!passwordEncoder.matches(request.getCurrentPassword(), guardian.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 올바르지 않습니다.");
        }
        if (!StringUtils.hasText(request.getNewPassword()) || request.getNewPassword().length() < 8) {
            throw new IllegalArgumentException("새 비밀번호는 8자 이상이어야 합니다.");
        }
        guardian.setPassword(passwordEncoder.encode(request.getNewPassword()));
    }

    @Transactional
    public void deleteAccount(Long guardianId) {
        seniorRepository.findByGuardianId(guardianId).forEach(senior -> {
            senior.setGuardianId(null);
            senior.setGuardianRelationship(null);
            senior.setGuardianLinkedAt(null);
        });
        guardianRepository.delete(findGuardian(guardianId));
    }

    private Guardian findGuardian(Long guardianId) {
        return guardianRepository.findById(guardianId)
                .orElseThrow(() -> new IllegalArgumentException("보호자를 찾을 수 없습니다."));
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }

    private String generateUniqueInviteCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                builder.append(INVITE_CODE_CHARS.charAt(
                        secureRandom.nextInt(INVITE_CODE_CHARS.length())));
            }
            code = builder.toString();
        } while (guardianRepository.existsByInviteCode(code));
        return code;
    }
}
