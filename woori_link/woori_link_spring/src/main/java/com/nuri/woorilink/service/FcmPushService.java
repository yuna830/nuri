package com.nuri.woorilink.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.nuri.woorilink.entity.PushToken;
import com.nuri.woorilink.repository.PushTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class FcmPushService {

    private static final String SENIOR_ROLE =
            "SENIOR";

    private final PushTokenRepository repository;

    /**
     * 앱에서 전달받은 FCM 토큰을 등록하거나 갱신합니다.
     */
    @Transactional
    public PushToken register(
            String role,
            Long userId,
            String token
    ) {
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException(
                    "사용자 역할이 필요합니다."
            );
        }

        if (userId == null) {
            throw new IllegalArgumentException(
                    "사용자 ID가 필요합니다."
            );
        }

        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException(
                    "FCM 토큰이 필요합니다."
            );
        }

        String normalizedRole =
                role.replaceFirst("^ROLE_", "")
                        .trim()
                        .toUpperCase();

        String normalizedToken =
                token.trim();

        PushToken value =
                repository.findByToken(
                                normalizedToken
                        )
                        .orElseGet(
                                PushToken::new
                        );

        value.setRole(
                normalizedRole
        );

        value.setUserId(
                userId
        );

        value.setToken(
                normalizedToken
        );

        PushToken saved =
                repository.save(
                        value
                );

        log.info(
                "[FCM 토큰 등록 완료] role={}, userId={}, token={}",
                normalizedRole,
                userId,
                maskToken(
                        normalizedToken
                )
        );

        return saved;
    }

    /**
     * 특정 어르신이 등록한 모든 기기로
     * 앱 푸시 알림을 전송합니다.
     *
     * 외부 Firebase 요청 실패가
     * 상위 업무 트랜잭션을 롤백시키지 않도록
     * 이 메서드에는 @Transactional을 사용하지 않습니다.
     */
    public SendResult sendToSenior(
            Long seniorId,
            String title,
            String body,
            Map<String, String> data
    ) {
        if (seniorId == null) {
            throw new IllegalArgumentException(
                    "어르신 ID가 필요합니다."
            );
        }

        if (
                title == null ||
                        title.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "알림 제목이 필요합니다."
            );
        }

        if (
                body == null ||
                        body.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "알림 내용이 필요합니다."
            );
        }

        if (
                FirebaseApp
                        .getApps()
                        .isEmpty()
        ) {
            log.error(
                    "[FCM 발송 실패] Firebase Admin SDK가 초기화되지 않았습니다."
            );

            throw new IllegalStateException(
                    "Firebase 서비스 계정이 설정되지 않았습니다."
            );
        }

        List<PushToken> tokens =
                repository.findByRoleAndUserId(
                        SENIOR_ROLE,
                        seniorId
                );

        if (tokens.isEmpty()) {
            log.warn(
                    "[FCM 발송 실패] 등록된 토큰 없음. seniorId={}",
                    seniorId
            );

            throw new NoSuchElementException(
                    "어르신 앱에 등록된 푸시 토큰이 없습니다."
            );
        }

        int successCount = 0;
        int failureCount = 0;

        FirebaseMessagingException lastException =
                null;

        List<PushToken> invalidTokens =
                new ArrayList<>();

        for (
                PushToken pushToken
                : tokens
        ) {
            String token =
                    pushToken.getToken();

            if (
                    token == null ||
                            token.isBlank()
            ) {
                failureCount++;

                invalidTokens.add(
                        pushToken
                );

                log.warn(
                        "[FCM 발송 제외] 비어 있는 토큰. tokenId={}, seniorId={}",
                        pushToken.getId(),
                        seniorId
                );

                continue;
            }

            try {
                Message.Builder messageBuilder =
                        Message.builder()
                                .setToken(
                                        token
                                )
                                .setNotification(
                                        Notification
                                                .builder()
                                                .setTitle(
                                                        title.trim()
                                                )
                                                .setBody(
                                                        body.trim()
                                                )
                                                .build()
                                );

                if (
                        data != null &&
                                !data.isEmpty()
                ) {
                    messageBuilder.putAllData(
                            data
                    );
                }

                String messageId =
                        FirebaseMessaging
                                .getInstance()
                                .send(
                                        messageBuilder
                                                .build()
                                );

                successCount++;

                log.info(
                        "[FCM 발송 성공] seniorId={}, token={}, messageId={}",
                        seniorId,
                        maskToken(
                                token
                        ),
                        messageId
                );

            } catch (
                    FirebaseMessagingException exception
            ) {
                failureCount++;

                lastException =
                        exception;

                MessagingErrorCode errorCode =
                        exception
                                .getMessagingErrorCode();

                log.error(
                        "[FCM 발송 실패] seniorId={}, token={}, errorCode={}, message={}",
                        seniorId,
                        maskToken(
                                token
                        ),
                        errorCode,
                        exception.getMessage(),
                        exception
                );

                if (
                        errorCode ==
                                MessagingErrorCode.UNREGISTERED
                ) {
                    invalidTokens.add(
                            pushToken
                    );

                    log.warn(
                            "[FCM 만료 토큰 삭제 예정] tokenId={}, seniorId={}, token={}",
                            pushToken.getId(),
                            seniorId,
                            maskToken(
                                    token
                            )
                    );
                }

            } catch (
                    RuntimeException exception
            ) {
                failureCount++;

                log.error(
                        "[FCM 처리 오류] seniorId={}, token={}, message={}",
                        seniorId,
                        maskToken(
                                token
                        ),
                        exception.getMessage(),
                        exception
                );
            }
        }

        /*
         * Spring Data Repository의 deleteAll 자체가
         * 필요한 트랜잭션을 처리합니다.
         *
         * sendToSenior 전체를 트랜잭션으로 묶지 않으므로
         * 이후 예외가 발생해도 상위 CheckIn 생성 트랜잭션을
         * rollback-only로 변경하지 않습니다.
         */
        if (!invalidTokens.isEmpty()) {
            repository.deleteAll(
                    invalidTokens
            );

            log.info(
                    "[FCM 무효 토큰 삭제 완료] seniorId={}, count={}",
                    seniorId,
                    invalidTokens.size()
            );
        }

        if (successCount == 0) {
            String detailMessage =
                    buildFailureMessage(
                            lastException
                    );

            throw new IllegalStateException(
                    detailMessage,
                    lastException
            );
        }

        return new SendResult(
                successCount,
                failureCount
        );
    }

    private String buildFailureMessage(
            FirebaseMessagingException exception
    ) {
        if (exception == null) {
            return "앱 알림 발송에 실패했습니다.";
        }

        MessagingErrorCode errorCode =
                exception.getMessagingErrorCode();

        if (
                errorCode ==
                        MessagingErrorCode.UNREGISTERED
        ) {
            return (
                    "어르신 앱의 알림 토큰이 만료되었습니다. "
                            + "어르신 앱을 다시 실행한 뒤 재시도해 주세요."
            );
        }

        if (
                errorCode ==
                        MessagingErrorCode
                                .SENDER_ID_MISMATCH
        ) {
            return (
                    "앱과 서버의 Firebase 프로젝트가 일치하지 않습니다."
            );
        }

        if (
                errorCode ==
                        MessagingErrorCode
                                .THIRD_PARTY_AUTH_ERROR
        ) {
            return (
                    "Firebase 인증 설정을 확인해 주세요."
            );
        }

        if (
                errorCode ==
                        MessagingErrorCode
                                .INVALID_ARGUMENT
        ) {
            return (
                    "FCM 토큰 또는 알림 요청 값이 올바르지 않습니다."
            );
        }

        if (
                errorCode ==
                        MessagingErrorCode
                                .QUOTA_EXCEEDED
        ) {
            return (
                    "Firebase 발송 한도를 초과했습니다."
            );
        }

        if (
                errorCode ==
                        MessagingErrorCode
                                .UNAVAILABLE
        ) {
            return (
                    "Firebase 서버에 일시적으로 연결할 수 없습니다."
            );
        }

        return (
                "앱 알림 발송에 실패했습니다. "
                        + "FCM 오류 코드: "
                        + (
                        errorCode != null
                                ? errorCode.name()
                                : "UNKNOWN"
                )
        );
    }

    /**
     * 로그에 토큰 전체가 노출되지 않도록 일부만 표시합니다.
     */
    private String maskToken(
            String token
    ) {
        if (
                token == null ||
                        token.isBlank()
        ) {
            return "EMPTY";
        }

        if (token.length() <= 12) {
            return "***";
        }

        return token.substring(
                0,
                6
        )
                + "..."
                + token.substring(
                token.length() - 6
        );
    }

    public record SendResult(
            int successCount,
            int failureCount
    ) {
    }
}