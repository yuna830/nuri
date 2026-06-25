package com.nuri.woorilink.domain.auth.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.domain.auth.dto.LoginRequest;
import com.nuri.woorilink.domain.auth.dto.LoginResponse;
import com.nuri.woorilink.domain.auth.dto.RegisterRequest;
import com.nuri.woorilink.domain.auth.entity.UserAccount;
import com.nuri.woorilink.domain.auth.entity.UserAccount.Role;
import com.nuri.woorilink.domain.auth.repository.UserAccountRepository;
import com.nuri.woorilink.domain.guardian.entity.Guardian;
import com.nuri.woorilink.domain.guardian.repository.GuardianRepository;
import com.nuri.woorilink.domain.senior.repository.SeniorRepository;
import com.nuri.woorilink.domain.welfare.entity.WelfareWorker;
import com.nuri.woorilink.domain.welfare.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserAccountRepository userAccountRepository;
    private final SeniorRepository seniorRepository;
    private final GuardianRepository guardianRepository;
    private final WelfareWorkerRepository welfareWorkerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public LoginResponse login(LoginRequest request) {
        UserAccount account = userAccountRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 계정입니다."));

        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }

        String name = resolveName(account);
        String token = tokenProvider.generateToken(
                account.getPhone(), account.getRole().name(), account.getReferenceId());

        return new LoginResponse(token, account.getRole().name(), account.getReferenceId(), name);
    }

    @Transactional
    public void registerWelfareWorker(RegisterRequest request) {
        validateDuplicatePhone(request.getPhone());

        WelfareWorker worker = welfareWorkerRepository.save(
                WelfareWorker.builder()
                        .name(request.getName())
                        .phone(request.getPhone())
                        .organization(request.getOrganization())
                        .email(request.getEmail())
                        .build()
        );

        saveAccount(request.getPhone(), request.getPassword(), Role.WELFARE_WORKER, worker.getId());
    }

    @Transactional
    public void registerGuardian(RegisterRequest request) {
        validateDuplicatePhone(request.getPhone());

        Guardian guardian = guardianRepository.save(
                Guardian.builder()
                        .name(request.getName())
                        .phone(request.getPhone())
                        .relationship(request.getRelationship())
                        .email(request.getEmail())
                        .build()
        );

        saveAccount(request.getPhone(), request.getPassword(), Role.GUARDIAN, guardian.getId());
    }

    private void validateDuplicatePhone(String phone) {
        if (userAccountRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }
    }

    private void saveAccount(String phone, String password, Role role, Long referenceId) {
        userAccountRepository.save(UserAccount.builder()
                .phone(phone)
                .password(passwordEncoder.encode(password))
                .role(role)
                .referenceId(referenceId)
                .build());
    }

    private String resolveName(UserAccount account) {
        return switch (account.getRole()) {
            case SENIOR -> seniorRepository.findById(account.getReferenceId())
                    .map(s -> s.getName()).orElse("어르신");
            case GUARDIAN -> guardianRepository.findById(account.getReferenceId())
                    .map(g -> g.getName()).orElse("보호자");
            case WELFARE_WORKER -> welfareWorkerRepository.findById(account.getReferenceId())
                    .map(w -> w.getName()).orElse("복지사");
        };
    }
}
