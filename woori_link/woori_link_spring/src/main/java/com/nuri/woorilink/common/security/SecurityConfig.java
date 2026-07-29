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
                        .authenticationEntryPoint((request, response, exception) ->
                                response.sendError(
                                        HttpStatus.UNAUTHORIZED.value(),
                                        "Authentication is required or the access token is invalid."
                                )
                        )
                        .accessDeniedHandler((request, response, exception) ->
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
                                "/api/actions/**",
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
                         * 제품 API
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
                         *
                         * 반드시 /api/energy-support/**
                         * 포괄 규칙보다 위에 있어야 한다.
                         * ========================================= */

                        /*
                         * 보호자가 상담 요청 생성
                         */
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/energy-support/consultations/seniors/*"
                        )
                        .hasRole(
                                "GUARDIAN"
                        )

                        /*
                         * 보호자 또는 복지사가 현재 상담 요청 상태 조회
                         */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/consultations/seniors/*/active"
                        )
                        .hasAnyRole(
                                "GUARDIAN",
                                "WELFARE_WORKER"
                        )

                        /*
                         * 복지사가 자신에게 배정된 상담 요청 목록 조회
                         */
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/energy-support/consultations/worker"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )

                        /*
                         * 복지사가 상담 처리 시작 또는 완료
                         */
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
                         *
                         * 복지사 전용
                         * 반드시 세부 규칙보다 아래에 둔다.
                         * ========================================= */
                        .requestMatchers(
                                "/api/energy-support/**"
                        )
                        .hasRole(
                                "WELFARE_WORKER"
                        )


                        /* =========================================
                         * 그 외 API
                         * ========================================= */
                        .anyRequest()
                        .authenticated()
                )

                .addFilterBefore(
                        new JwtAuthenticationFilter(
                                tokenProvider
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
