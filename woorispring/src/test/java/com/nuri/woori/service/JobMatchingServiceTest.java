package com.nuri.woori.service;

import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.service.JobMatchingService.JobCandidate;
import com.nuri.woori.service.JobMatchingService.JobRecommendation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobMatchingServiceTest {

    @Mock
    private SeniorRepository seniorRepository;

    @Mock
    private HealthInfoRepository healthInfoRepository;

    @Mock
    private JobPreferenceRepository jobPreferenceRepository;

    private JobMatchingService jobMatchingService;

    @BeforeEach
    void setUp() {
        jobMatchingService = new JobMatchingService(
                seniorRepository,
                healthInfoRepository,
                jobPreferenceRepository
        );
    }

    @Test
    void recommendsSuitableJobWhenActivityTimeAndJobTypeMatch() {
        givenSeniorWithHealthAndPreference(healthyInfo(), preference("공익활동", "실내, 반복 작업"));

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(job("job-1", "도서관 자료 정리", "공익활동", "실내", "낮음", "3", "도보 10분 이내", false)),
                5
        );

        assertThat(recommendations).hasSize(1);
        assertThat(recommendations.get(0).score()).isEqualTo(100);
        assertThat(recommendations.get(0).grade()).isEqualTo("적합");
        assertThat(recommendations.get(0).reasons()).contains(
                "희망 직종과 공고 직종이 일치합니다.",
                "하루 활동 가능 시간 안에 근무 시간이 들어옵니다."
        );
    }

    @Test
    void penalizesOutdoorJobWhenOutdoorWorkIsDifficult() {
        HealthInfo healthInfo = healthyInfo();
        healthInfo.setDisabledWork("야외 작업 어려움");
        givenSeniorWithHealthAndPreference(healthInfo, preference("공익활동", "실내 선호"));

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(job("job-1", "공원 환경 정비", "공익활동", "야외", "낮음", "3", "도보 10분 이내", false)),
                5
        );

        assertThat(recommendations).hasSize(1);
        assertThat(recommendations.get(0).warnings()).contains("야외 작업이 어려운 조건인데 야외 공고입니다.");
    }

    @Test
    void heavilyPenalizesHighIntensityJobWhenHealthStatusIsDanger() {
        HealthInfo healthInfo = healthyInfo();
        healthInfo.setHealthStatus("위험");
        givenSeniorWithHealthAndPreference(healthInfo, null);

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(job("job-1", "시설물 운반 보조", "실내 보조", "실내", "높음", "3", "도보 10분 이내", false)),
                5
        );

        assertThat(recommendations).hasSize(1);
        assertThat(recommendations.get(0).score()).isLessThan(60);
        assertThat(recommendations.get(0).grade()).isEqualTo("부적합");
        assertThat(recommendations.get(0).warnings()).contains("건강 상태가 위험인데 고강도 업무입니다.");
    }

    @Test
    void penalizesLongDistanceRegionalJobs() {
        givenSeniorWithHealthAndPreference(healthyInfo(), preference("공익활동", "실내"));

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(job("job-1", "타지역 사무 보조", "공익활동", "실내", "낮음", "3", "타지역 장거리", false)),
                5
        );

        assertThat(recommendations).hasSize(1);
        assertThat(recommendations.get(0).score()).isLessThan(80);
        assertThat(recommendations.get(0).grade()).isNotEqualTo("적합");
        assertThat(recommendations.get(0).warnings()).contains("대상자 거주 지역과 공고 지역이 달라 이동 부담이 큽니다.");
    }

    @Test
    void excludesClosedJobs() {
        givenSeniorWithHealthAndPreference(healthyInfo(), null);

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(job("job-1", "마감 공고", "공익활동", "실내", "낮음", "3", "도보 10분 이내", true)),
                5
        );

        assertThat(recommendations).isEmpty();
    }

    @Test
    void sortsByScoreAndAppliesLimit() {
        givenSeniorWithHealthAndPreference(healthyInfo(), preference("공익활동", "실내"));

        List<JobRecommendation> recommendations = jobMatchingService.recommend(
                1L,
                List.of(
                        job("job-low", "야외 정리", "환경 정비", "야외", "중간", "6", "대중교통 1시간 이내", false),
                        job("job-high", "도서관 자료 정리", "공익활동", "실내", "낮음", "3", "도보 10분 이내", false),
                        job("job-mid", "복지관 안내", "안내", "실내", "낮음", "4", "도보 30분 이내", false)
                ),
                2
        );

        assertThat(recommendations).hasSize(2);
        assertThat(recommendations.get(0).jobId()).isEqualTo("job-high");
        assertThat(recommendations.get(0).score()).isGreaterThanOrEqualTo(recommendations.get(1).score());
    }

    private void givenSeniorWithHealthAndPreference(HealthInfo healthInfo, JobPreference jobPreference) {
        Senior senior = new Senior();
        senior.setId(1L);

        when(seniorRepository.findById(1L)).thenReturn(Optional.of(senior));
        when(healthInfoRepository.findTopBySeniorIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.ofNullable(healthInfo));
        when(jobPreferenceRepository.findTopBySeniorIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.ofNullable(jobPreference));
    }

    private HealthInfo healthyInfo() {
        HealthInfo healthInfo = new HealthInfo();
        healthInfo.setHealthStatus("양호");
        healthInfo.setMaxHours("4");
        healthInfo.setMaxDistance("도보 30분 이내");
        healthInfo.setWalkingAid("없음");
        healthInfo.setRecentFall("없음");
        return healthInfo;
    }

    private JobPreference preference(String hopeJobType, String hopeCondition) {
        JobPreference jobPreference = new JobPreference();
        jobPreference.setHopeJobType(hopeJobType);
        jobPreference.setHopeCondition(hopeCondition);
        return jobPreference;
    }

    private JobCandidate job(
            String jobId,
            String title,
            String jobType,
            String workEnvironment,
            String physicalIntensity,
            String dailyHours,
            String commuteLevel,
            boolean closed
    ) {
        return new JobCandidate(
                jobId,
                title,
                "테스트 기관",
                jobType,
                workEnvironment,
                physicalIntensity,
                dailyHours,
                commuteLevel,
                List.of("반복 작업"),
                closed,
                List.of("주 3일"),
                "가벼운 업무"
        );
    }
}
