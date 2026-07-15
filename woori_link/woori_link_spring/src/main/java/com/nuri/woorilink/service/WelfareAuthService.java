package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.dto.WelfareLoginRequest;
import com.nuri.woorilink.dto.WelfareLoginIdFindRequest;
import com.nuri.woorilink.dto.WelfarePasswordResetRequest;
import com.nuri.woorilink.dto.WelfareWorkerRegisterRequest;
import com.nuri.woorilink.entity.WelfareWorker;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class WelfareAuthService {

    private final WelfareWorkerRepository welfareWorkerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(WelfareLoginRequest request) {
        if (!StringUtils.hasText(request.getLoginId())) {
            throw new IllegalArgumentException("아이디를 입력해주세요.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new IllegalArgumentException("비밀번호를 입력해주세요.");
        }

        WelfareWorker worker = welfareWorkerRepository.findFirstByLoginId(request.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 복지사 계정입니다."));

        if (!passwordEncoder.matches(request.getPassword(), worker.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }

        String token = tokenProvider.generateToken(worker.getLoginId(), "WELFARE_WORKER", worker.getId());
        return new LoginResponse(token, "WELFARE_WORKER", worker.getId(), worker.getName());
    }

    @Transactional
    public void register(WelfareWorkerRegisterRequest request) {
        if (!StringUtils.hasText(request.getLoginId())) {
            throw new IllegalArgumentException("아이디를 입력해주세요.");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new IllegalArgumentException("비밀번호를 입력해주세요.");
        }
        if (welfareWorkerRepository.existsByLoginId(request.getLoginId())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }

        welfareWorkerRepository.save(WelfareWorker.builder()
                .loginId(request.getLoginId())
                .name(request.getName())
                .phone(normalizePhone(request.getPhone()))
                .password(passwordEncoder.encode(request.getPassword()))
                .organization(request.getOrganization())
                .email(request.getEmail())
                .build());
    }

    public boolean isLoginIdAvailable(String loginId) {
        return !welfareWorkerRepository.existsByLoginId(loginId);
    }

    public String findLoginId(WelfareLoginIdFindRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(request.getName()) || !StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("이름과 전화번호를 입력해주세요.");
        }

        return welfareWorkerRepository.findFirstByNameAndPhone(request.getName(), phone)
                .map(WelfareWorker::getLoginId)
                .orElseThrow(() -> new IllegalArgumentException("일치하는 복지사 계정이 없습니다."));
    }

    @Transactional
    public void resetPassword(WelfarePasswordResetRequest request) {
        String phone = normalizePhone(request.getPhone());
        if (!StringUtils.hasText(request.getLoginId()) || !StringUtils.hasText(request.getName())
                || !StringUtils.hasText(phone) || !StringUtils.hasText(request.getNewPassword())) {
            throw new IllegalArgumentException("모든 항목을 입력해주세요.");
        }
        if (request.getNewPassword().length() < 8) {
            throw new IllegalArgumentException("새 비밀번호는 8자 이상이어야 합니다.");
        }

        WelfareWorker worker = welfareWorkerRepository
                .findFirstByLoginIdAndNameAndPhone(request.getLoginId(), request.getName(), phone)
                .orElseThrow(() -> new IllegalArgumentException("일치하는 복지사 계정이 없습니다."));
        worker.setPassword(passwordEncoder.encode(request.getNewPassword()));
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }
}
