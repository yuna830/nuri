package com.nuri.woorilink.common.config;
import lombok.Getter; import lombok.Setter; import org.springframework.boot.context.properties.ConfigurationProperties; import org.springframework.context.annotation.Configuration;
@Configuration @ConfigurationProperties(prefix="recall") @Getter @Setter
public class RecallSafetyProperties { private boolean newDecisionEngineEnabled; private boolean schedulerEnabled; private boolean notificationEnabled; private boolean dryRun=true; private String schedulerCron="0 0 3 * * *"; private String schedulerZone="Asia/Seoul"; }
