package com.nuri.woorilink.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "public-data")
@Getter @Setter
public class PublicDataConfig {
    private String recallApiKey;
    private String recallListUrl;
    private String recallDetailUrl;
    private int recallConnectTimeoutMs = 5000;
    private int recallReadTimeoutMs = 8000;
    private String weatherApiKey;
    private String energyEfficiencyApiKey;
    private String welfareFacilityApiKey;
    private String kakaoRestApiKey;
}
