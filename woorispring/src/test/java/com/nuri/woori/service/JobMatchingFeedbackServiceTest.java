package com.nuri.woori.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobMatchingFeedback;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobMatchingFeedbackRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.service.JobMatchingService.JobCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobMatchingFeedbackServiceTest {

    @Mock
    private SeniorRepository seniorRepository;

    @Mock
    private HealthInfoRepository healthInfoRepository;

    @Mock
    private JobPreferenceRepository jobPreferenceRepository;

    @Mock
    private JobMatchingFeedbackRepository feedbackRepository;

    private JobMatchingFeedbackService service;

    @BeforeEach
    void setUp() {
        service = new JobMatchingFeedbackService(
                seniorRepository,
                healthInfoRepository,
                jobPreferenceRepository,
                feedbackRepository,
                new ObjectMapper()
        );
    }

    @Test
    void savesFeedbackWithHealthAndJobSnapshot() {
        Senior senior = new Senior();
        senior.setId(1L);

        HealthInfo healthInfo = new HealthInfo();
        healthInfo.setHealthStatus("주의");
        healthInfo.setMedicineCount("3개");
        healthInfo.setWalkingAid("없음");
        healthInfo.setRecentFall("없음");
        healthInfo.setMaxHours("4");
        healthInfo.setMaxDistance("도보 30분 이내");
        healthInfo.setDisabledWork("실내 선호");
        healthInfo.setJointDisease("관절 통증");

        JobPreference jobPreference = new JobPreference();
        jobPreference.setHopeJobType("사무 보조");
        jobPreference.setHopeCondition("가벼운 실내 업무");

        when(seniorRepository.findById(1L)).thenReturn(Optional.of(senior));
        when(healthInfoRepository.findTopBySeniorIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.of(healthInfo));
        when(jobPreferenceRepository.findTopBySeniorIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.of(jobPreference));
        when(feedbackRepository.save(any(JobMatchingFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));

        JobMatchingFeedback feedback = service.saveFeedback(new JobMatchingFeedbackService.FeedbackRequest(
                1L,
                "적합",
                "ML",
                85,
                "적합",
                "적합",
                73,
                Map.of("적합", 0.73, "검토", 0.2, "부적합", 0.07),
                job()
        ));

        assertThat(feedback.getLabel()).isEqualTo("적합");
        assertThat(feedback.getHealthStatus()).isEqualTo("주의");
        assertThat(feedback.getHopeJobType()).isEqualTo("사무 보조");
        assertThat(feedback.getJobType()).isEqualTo("사무 보조");
        assertThat(feedback.getMlProbabilitiesJson()).contains("적합");
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> service.saveFeedback(new JobMatchingFeedbackService.FeedbackRequest(
                1L,
                "확정",
                "MANUAL",
                null,
                null,
                null,
                null,
                null,
                job()
        ))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void exportsTrainingCsv() {
        JobMatchingFeedback row = new JobMatchingFeedback();
        row.setLabel("검토");
        row.setHealthStatus("주의");
        row.setMedicineCount("3개");
        row.setWalkingAid("없음");
        row.setRecentFall("없음");
        row.setDisabledWork("실내 선호");
        row.setMaxHours("4");
        row.setMaxDistance("도보 30분 이내");
        row.setDiseaseText("관절 통증");
        row.setHopeJobType("사무 보조");
        row.setHopeCondition("가벼운 실내 업무");
        row.setJobType("사무 보조");
        row.setWorkEnvironment("실내");
        row.setPhysicalIntensity("낮음");
        row.setDailyHours("3");
        row.setCommuteLevel("도보 10분 이내");
        row.setTaskTags("반복 작업");
        row.setClosed(false);

        when(feedbackRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(row));

        String csv = service.exportTrainingCsv();

        assertThat(csv).contains("label,health_status,medicine_count");
        assertThat(csv).contains("\"검토\",\"주의\",\"3개\"");
    }

    private JobCandidate job() {
        return new JobCandidate(
                "job-1",
                "도서관 자료 정리",
                "구립도서관",
                "사무 보조",
                "실내",
                "낮음",
                "3",
                "도보 10분 이내",
                List.of("반복 작업"),
                false,
                List.of("주 3일"),
                "자료 정리"
        );
    }
}
