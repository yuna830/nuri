package com.nuri.woorilink.common.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider tokenProvider;
    private final AccountExistenceService accountExistenceService;

    @Value(
            "#{'${app.cors.allowed-origin-patterns}'.split(',')}"
    )
    private List<String> allowedOriginPatterns;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http
    ) throws Exception {

        http
                .cors(cors ->
                        cors.configurationSource(
                                corsConfigurationSource()
                        )
                )

                .csrf(
                        AbstractHttpConfigurer::disable
                )

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(
                                (request, response, exception) ->
                                        response.sendError(
                                                HttpStatus.UNAUTHORIZED.value(),
                                                "Authentication is required or the access token is invalid."
                                        )
                        )
                        .accessDeniedHandler(
                                (request, response, exception) ->
                                        response.sendError(
                                                HttpStatus.FORBIDDEN.value(),
                                                "You do not have permission to access this resource."
                                        )
                        )
                )

                .authorizeHttpRequests(auth -> auth

                        /* =========================================
                         * 인증 없이 접근 가능한 API
                         * ========================================= */
                        .requestMatchers(
                                "/api/welfare-auth/**",
                                "/api/guardian-auth/**",
                                "/api/senior-auth/**",
                                "/api/welfare-facilities/**",
                                "/api/health",
                                "/api/alerts/fall",
                                "/error"
                        )
                        .permitAll()

                        /* =========================================
                         * Swagger
                         * ========================================= */
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/v3/api-docs/**"
                        )
                        .permitAll()

                        /* =========================================
                         * 제품 등록 API
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/products"
                        )
                        .permitAll()

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/products/*/notifications"
                        )
                        .permitAll()

                        /* =========================================
                         * 리콜 후속조치 API
                         *
                         * 로그인한 복지사만 접근할 수 있다.
                         * 세부 담당자 권한은 Service에서 다시 검증한다.
                         * ========================================= */
                        .requestMatchers(
                                "/api/recall-follow-ups/**"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        /* =========================================
                         * 보호자 알림
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/care/guardians/*/alerts"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/care/guardians/*/alerts"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )

                        /* =========================================
                         * 복지사 알림
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/care/welfare-alerts"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        /* =========================================
                         * 에너지복지 상담 요청
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/energy-support/consultations/seniors/*"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/consultations/seniors/*/active"
                        )
                        .hasAnyRole(
                                "GUARDIAN",
                                "WELFARE_WORKER"
                        )

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/consultations/worker"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/energy-support/consultations/*/start",
                                "/api/energy-support/consultations/*/resolve"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        /* =========================================
                         * 에너지복지 완료 및 상세 조회
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/completion/**",
                                "/api/energy-support/profile/**",
                                "/api/energy-support/gas/**",
                                "/api/energy-support/electricity/**",
                                "/api/energy-support/voucher/**"
                        )
                        .hasAnyRole(
                                "SENIOR",
                                "GUARDIAN",
                                "WELFARE_WORKER"
                        )

                        /* =========================================
                         * 에너지바우처 저장
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/energy-support/voucher/**"
                        )
                        .hasAnyRole(
                                "SENIOR",
                                "GUARDIAN",
                                "WELFARE_WORKER"
                        )

                        /* =========================================
                         * 공통·전기·가스 정보 저장
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/energy-support/profile/**",
                                "/api/energy-support/electricity/**",
                                "/api/energy-support/gas/**"
                        )
                        .hasAnyRole(
                                "SENIOR",
                                "GUARDIAN"
                        )

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/consultations/*"
                        )
                        .hasAnyRole(
                                "GUARDIAN",
                                "WELFARE_WORKER"
                        )

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/energy-support/consultations/*/schedule/propose"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/energy-support/consultations/*/schedule/confirm",
                                "/api/energy-support/consultations/*/schedule/request-change"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )

                        /* =========================================
                         * 나머지 에너지복지 API
                         * ========================================= */
                        .requestMatchers(
                                "/api/energy-support/**"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )
                        // 보호자 본인 조회 권한 추가
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/seniors/by-guardian/me"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )
                        // 제품 사용자 변결
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/products/*/senior"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )
                        /* =========================================
                         * 보호자 리콜 후속조치 공개 조회
                         *
                         * 보호자는 자신과 연결된 어르신의
                         * 공개 가능한 진행 상태만 조회할 수 있습니다.
                         * 실제 연결 관계는 Service에서 다시 검증합니다.
                         * ========================================= */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/guardian/recall-follow-ups",
                                "/api/guardian/recall-follow-ups/*"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )
                        /* =========================================
                         * 그 외 API
                         * ========================================= */
                        .anyRequest()
                        .authenticated()
                )

                .addFilterBefore(
                        new JwtAuthenticationFilter(
                                tokenProvider,
                                accountExistenceService
                        ),
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config =
                new CorsConfiguration();

        config.setAllowedOriginPatterns(
                allowedOriginPatterns
                        .stream()
                        .map(String::trim)
                        .filter(origin ->
                                !origin.isEmpty()
                        )
                        .toList()
        );

        config.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        config.setAllowedHeaders(
                List.of("*")
        );

        config.setAllowCredentials(
                true
        );

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                config
        );

        return source;
    }
}