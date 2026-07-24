package com.nuri.woorilink.dto;

import java.util.List;
import java.util.Map;

public record EnergySupportCompletionDto(
        Long seniorId,
        boolean completed,
        int completionRate,
        int missingCount,
        Map<String, List<String>> missingInformation
) {
}
