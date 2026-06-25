package com.nuri.woorilink.domain.auth.service;

import com.nuri.woorilink.common.security.JwtTokenProvider;
import com.nuri.woorilink.domain.auth.dto.LoginRequest;
import com.nuri.woorilink.domain.auth.dto.LoginResponse;
import com.nuri.woorilink.domain.auth.dto.RegisterRequest;
import com.nuri.woorilink.domain.auth.entity.UserAccount;
import com.nuri.woorilink.domain.auth.repository.UserAccountRepository;
import com.nuri.woorilink.domain.guardian.repository.GuardianRepository;
import com.nuri.woorilink.domain.senior.repository.SeniorRepository;
import com.nuri.woorilink.domain.welfare.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    public void register(RegisterRequest request) {
        if (userAccountRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }

        userAccountRepository.save(UserAccount.builder()
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .referenceId(request.getReferenceId())
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
