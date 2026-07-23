package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.Guardian;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class GuardianProfileResponse {
    private Long id;
    private String name;
    private String phone;
    private String relationship;
    private String email;
    private String address;
    private String inviteCode;
    private java.time.LocalDateTime inviteCodeExpiresAt;
    private Boolean checkInAlertEnabled;
    private Boolean fallAlertEnabled;
    private Boolean safetyZoneAlertEnabled;
    private Boolean recallAlertEnabled;
    private Boolean weatherAlertEnabled;
    private Boolean welfareAlertEnabled;
    private Boolean appNotificationEnabled;
    private Boolean webNotificationEnabled;
    private Boolean kakaoNotificationEnabled;

    public static GuardianProfileResponse from(Guardian guardian) {
        return new GuardianProfileResponse(
                guardian.getId(), guardian.getName(), guardian.getPhone(),
                guardian.getRelationship(), guardian.getEmail(), guardian.getAddress(),
                guardian.getInviteCode(),
                guardian.getInviteCodeExpiresAt(), guardian.getCheckInAlertEnabled(),
                guardian.getFallAlertEnabled(), guardian.getSafetyZoneAlertEnabled(),
                guardian.getRecallAlertEnabled(), guardian.getWeatherAlertEnabled(),
                guardian.getWelfareAlertEnabled(), guardian.getAppNotificationEnabled(),
                guardian.getWebNotificationEnabled(), guardian.getKakaoNotificationEnabled()
        );
    }
}
