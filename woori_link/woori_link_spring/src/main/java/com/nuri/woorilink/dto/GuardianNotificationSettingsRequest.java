package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class GuardianNotificationSettingsRequest {
    private Boolean checkInAlertEnabled;
    private Boolean fallAlertEnabled;
    private Boolean safetyZoneAlertEnabled;
    private Boolean recallAlertEnabled;
    private Boolean weatherAlertEnabled;
    private Boolean welfareAlertEnabled;
    private Boolean appNotificationEnabled;
    private Boolean webNotificationEnabled;
}
