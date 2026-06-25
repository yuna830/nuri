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
    private String weatherApiKey;
    private String energyEfficiencyApiKey;
}
