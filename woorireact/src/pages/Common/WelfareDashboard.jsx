// React에서 useState 기능을 가져옴
// useState은 화면에서 값이 바뀌었을 때 다시 렌더링되도록 도와주는 기능
// 여기서는 복지사가 누른 "적합 / 보류 / 부적합" 판단 결과를 화면에 바로 반영하기 위해 사용함
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const WELFARE_SENIOR_API_URL = "http://localhost:8083/api/welfare/seniors";

const FILTER_GROUPS = [
    { key : "healthStatus", label : "건강 상태", options : ["양호", "주의", "위험"] },
    { key : "locationStatus", label : "위치 상태", options : ["정상", "안전구역 이탈"] },
    { key : "alertStatus", label : "알림 상태", options : ["없음", "미복용"] },
    { key : "jobStatus", label : "일자리 상태", options : ["추천 완료", "지원 중", "미추천"] },
    { key : "welfareDecision", label : "복지사 판단", options : ["미검토", "적합", "보류", "부적합"] },
];

const createEmptyFilters = () => ({
    healthStatus : [],
    locationStatus : [],
    alertStatus : [],
    jobStatus : [],
    welfareDecision : [],
});

// WelfareDashboard 컴포넌트
// 복지사가 담당 노인들의 상태를 한눈에 확인할 수 있는 대상자 관리 페이지
function WelfareDashboard(){
    // seniors 배열
    // 복지사가 관리하는 노인 대상자들의 임시 데이터
    // 나중에는 이 데이터를 백엔드(Spring Boot)나 DB(MySQL)에서 받아오게 됨
    const [seniors, setSeniors] = useState([]);
    const [isLoadingSeniors, setIsLoadingSeniors] = useState(true);
    const [seniorLoadError, setSeniorLoadError] = useState("");

    useEffect(() => {
        let ignore = false;

        const loadSeniors = async () => {
            try {
                setIsLoadingSeniors(true);
                setSeniorLoadError("");

                const response = await fetch(WELFARE_SENIOR_API_URL);

                if (!response.ok) {
                    throw new Error("Failed to load seniors");
                }

                const data = await response.json();

                if (!ignore) {
                    setSeniors(data);
                }
            } catch (error) {
                if (!ignore) {
                    setSeniorLoadError("대상자 데이터를 불러오지 못했습니다.");
                    setSeniors([]);
                }
            } finally {
                if (!ignore) {
                    setIsLoadingSeniors(false);
                }
            }
        };

        loadSeniors();

        return () => {
            ignore = true;
        };
    }, []);

    // 현재 페이지 번호
    // 처음 화면에서는 1페이지부터 보여주기 위해 기본값을 1로 설정
    const [currentPage, setCurrentPage] = useState(1);

    // 현재 선택된 필터 컬럼
    const [activeFilterKey, setActiveFilterKey] = useState("healthStatus");

    // 검색 버튼을 눌러 실제로 적용된 체크박스 필터 값
    const [filters, setFilters] = useState(createEmptyFilters);

    // 체크박스에서 선택 중인 임시 필터 값
    const [draftFilters, setDraftFilters] = useState(createEmptyFilters);

    // 검색 버튼을 눌러 실제로 적용된 검색어
    const [searchKeyword, setSearchKeyword] = useState("");

    // 입력칸에서 작성 중인 임시 검색어
    const [draftSearchKeyword, setDraftSearchKeyword] = useState("");

    // 한 페이지에 보여줄 대상자 수
    // 현재는 한 페이지에 10명씩 보여줌
    const itemPerPage = 10;

    const isFilterMatched = (selectedValues, value) =>
        selectedValues.length === 0 || selectedValues.includes(value);

    // 선택한 필터 조건에 맞는 대상자만 남김
    // 선택된 체크박스가 없는 컬럼은 전체가 선택된 것처럼 모두 통과시킴
    const filteredSeniors = seniors.filter((senior) => {
        const matchHealth = isFilterMatched(filters.healthStatus, senior.healthStatus);
        const matchLocation = isFilterMatched(filters.locationStatus, senior.locationStatus);
        const matchAlert = isFilterMatched(filters.alertStatus, senior.alertStatus);
        const matchJob = isFilterMatched(filters.jobStatus, senior.jobStatus);
        const matchDecision = isFilterMatched(filters.welfareDecision, senior.welfareDecision);
        const normalizedKeyword = searchKeyword.trim().toLowerCase();
        const searchableValues = [
            senior.name,
            senior.age,
            senior.gender,
            senior.region,
            senior.healthStatus,
            senior.lastAccess,
            senior.locationStatus,
            senior.alertStatus,
            senior.jobStatus,
            senior.welfareDecision,
        ];
        const matchKeyword =
            normalizedKeyword === "" ||
            searchableValues.some((value) =>
                String(value ?? "").toLowerCase().includes(normalizedKeyword)
            );
        
        // 모든 조건이 true인 대상자만 최종적으로 남김
        return (
            matchHealth &&
            matchLocation &&
            matchAlert &&
            matchJob &&
            matchDecision &&
            matchKeyword
        );
    });

    // 전체 페이지 수 계산
    // 필터가 적용된 대상자 수를 기준으로 페이지 수를 계산함
    // 필터 결과가 7명이면 1페이지
    // Math.max(1, ...)는 필터 결과가 0명이어도 페이지 표시가 깨지지 않게 하기 위함
    const totalPages = Math.max(1, Math.ceil(filteredSeniors.length / itemPerPage));

    // 현재 페이지에서 보여줄 데이터의 시작 인덱스
    // 1페이지면 0, 2페이지면 10, 3페이지면 20
    const startIndex = (currentPage - 1) * itemPerPage;

    // 현재 페이지에서 보여줄 데이터의 끝 인덱스
    // 1페이지면 10, 2페이지면 20, 3페이지면 30
    const endIndex = startIndex + itemPerPage;

    // 우선순위 등급을 계산하는 함수
    // 숫자가 작을수록 더 높은 우선순위
    // 알림, 위치, 건강 상태를 기준으로 확인이 필요한 대상자를 위로 올림
    const getPriorityRank = (senior) => {
        // 1순위 : 위치 이탈
        // 안전구역 이탈 대상자를 먼저 확인
        if (senior.locationStatus === "안전구역 이탈") {
            return 1;
        }

        // 2순위 : 건강 위험
        // 건강 상태가 위험이면 빠른 확인이 필요함
        if (senior.healthStatus === "위험") {
            return 2;
        }

        // 3순위 : 미복용
        // 약 복용 여부 확인이 필요한 대상자
        if (senior.alertStatus === "미복용") {
            return 3;
        }

        // 4순위 : 건강 주의
        // 위험은 아니지만 지속적인 확인이 필요한 대상자
        if (senior.healthStatus === "주의") {
            return 4;
        }

        // 5순위 : 특별한 위험 없음
        return 5;
    };

    // 필터링된 대상자 목록을 우선순위 기준으로 정렬
    // 우선순위 등급이 높은 대상자가 위로 오도록 정렬
    // getPriorityRank 값이 작을수록 위로 올라감
    // [...seniors]는 기존 seniors 배열을 직접 바꾸지 않기 위해 복사하는 코드
    const sortedSeniors = [...filteredSeniors].sort((a, b) => {
        const rankA = getPriorityRank(a);
        const rankB = getPriorityRank(b);

        // 우선순위 등급이 다르면 등급 기준으로 정렬
        // 예 : 1순위가 3순위보다 위에 표시됨
        if (rankA !== rankB) {
            return rankA - rankB;
        }

        // 같은 등급이면 기존 id 순서대로 정렬
        // 예 : 둘 다 같은 우선순위이면 id가 작은 대상자가 먼저 나옴
        return a.id - b.id;
    });

    // 현재 페이지에 해당하는 대상자 10명만 잘라서 저장
    // 필터 적용 -> 우선순위 정렬 -> 페이지네이션 순서로 처리함
    const currentSeniors = sortedSeniors.slice(startIndex, endIndex);

    // 이전 페이지로 이동
    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // 다음 페이지로 이동
    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    // 특정 페이지 번호로 이동
    const goToPage = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    const cloneFilters = (targetFilters) => ({
        healthStatus : [...targetFilters.healthStatus],
        locationStatus : [...targetFilters.locationStatus],
        alertStatus : [...targetFilters.alertStatus],
        jobStatus : [...targetFilters.jobStatus],
        welfareDecision : [...targetFilters.welfareDecision],
    });

    const activeFilterGroup =
        FILTER_GROUPS.find((group) => group.key === activeFilterKey) || FILTER_GROUPS[0];

    const toggleDraftFilter = (filterKey, option) => {
        setDraftFilters((previousFilters) => {
            const selectedValues = previousFilters[filterKey];
            const nextValues = selectedValues.includes(option)
                ? selectedValues.filter((value) => value !== option)
                : [...selectedValues, option];

            return {
                ...previousFilters,
                [filterKey] : nextValues,
            };
        });
    };

    const getFilterOptionCount = (filterKey, option) =>
        seniors.filter((senior) => senior[filterKey] === option).length;

    // 체크박스에서 고른 임시 필터 값을 실제 목록 필터에 적용함
    // 검색 버튼을 눌렀을 때만 게시판 내용이 바뀌도록 분리함
    const applyFilters = () => {
        setFilters(cloneFilters(draftFilters));
        setSearchKeyword(draftSearchKeyword.trim());
        setCurrentPage(1);
    };

    // 체크박스와 실제 적용 필터를 모두 비워서 전체가 보이게 되돌림
    const resetFilters = () => {
        setDraftFilters(createEmptyFilters());
        setFilters(createEmptyFilters());
        setDraftSearchKeyword("");
        setSearchKeyword("");
        setActiveFilterKey("healthStatus");
        setCurrentPage(1);
    };

    // 상단 요약 카드에 표시할 숫자
    // 기존에는 문장으로 전체 수와 필터 결과를 보여줬지만,
    // 디자인 변경 후에는 카드 4개로 나눠서 더 빠르게 확인할 수 있게 함
    const summaryCounts = {
        // 전체 대상자 수
        total : seniors.length,

        // 현재 선택된 필터 조건에 맞는 대상자 수
        filtered : filteredSeniors.length,

        // 건강 상태가 "위험"인 대상자 수
        danger : seniors.filter((senior) => senior.healthStatus === "위험").length,

        // 알림 상태가 "없음"이 아닌 대상자 수
        alert : seniors.filter((senior) => senior.alertStatus !== "없음").length,
    };

    // 화면에서 반복해서 사용하는 스타일
    // CSS 파일을 새로 만들지 않고 이 컴포넌트 안에서만 쓰기 위해 객체로 정리함
    // 색상은 index.css에 이미 정의된 CSS 변수들을 최대한 사용함
    const styles = {
        // 전체 페이지 배경과 기본 여백
        page : {
            minHeight : "100vh",
            backgroundColor : "var(--bg-color)",
            color : "var(--text-color)",
            boxSizing : "border-box",
        },

        // 다른 페이지와 맞춘 상단 헤더
        topHeader : {
            height : "64px",
            padding : "0 max(28px, calc((100% - 1280px) / 2 + 28px))",
            borderBottom : "1px solid var(--border-color)",
            backgroundColor : "white",
            display : "flex",
            alignItems : "center",
            justifyContent : "space-between",
            boxSizing : "border-box",
        },

        // 헤더 왼쪽 브랜드 영역
        brandArea : {
            display : "flex",
            alignItems : "center",
            gap : "12px",
        },

        // 브랜드 로고 박스
        logoBox : {
            width : "34px",
            height : "34px",
            borderRadius : "7px",
            backgroundColor : "var(--main-color)",
            color : "white",
            display : "grid",
            placeItems : "center",
            fontSize : "15px",
            fontWeight : "800",
            lineHeight : "1",
        },

        // 서비스명
        serviceName : {
            fontSize : "22px",
            fontWeight : "800",
            color : "var(--text-color)",
        },

        // 현재 페이지 이름
        headerPageName : {
            paddingLeft : "16px",
            borderLeft : "1px solid var(--border-color)",
            color : "#4B5563",
            fontSize : "15px",
        },

        // 좌우 여백을 제외한 실제 화면 내용 너비
        content : {
            width : "100%",
            maxWidth : "1280px",
            margin : "0 auto",
            padding : "28px 28px 22px",
            boxSizing : "border-box",
        },

        // 상단 요약 카드 4개를 가로로 배치하는 영역
        summaryGrid : {
            display : "grid",
            gridTemplateColumns : "repeat(4, minmax(0, 1fr))",
            gap : "12px",
            marginBottom : "16px",
        },

        // 각각의 요약 카드
        summaryBox : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },

        // 요약 카드의 작은 제목
        summaryLabel : {
            margin : 0,
            fontSize : "13px",
            color : "#666",
        },

        // 요약 카드의 숫자
        summaryValue : {
            margin : "6px 0 0",
            fontSize : "24px",
            fontWeight : "700",
        },

        // 필터 탭과 체크박스들을 감싸는 영역
        filterBox : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "16px",
            marginBottom : "16px",
        },

        // 필터 컬럼을 선택하는 상단 탭
        filterTabs : {
            display : "grid",
            gridTemplateColumns : "repeat(5, minmax(0, 1fr))",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            overflow : "hidden",
            marginBottom : "14px",
        },

        // 필터 컬럼 탭 버튼
        filterTab : {
            minHeight : "44px",
            border : "none",
            backgroundColor : "white",
            color : "var(--text-color)",
            fontSize : "14px",
            fontWeight : "700",
            cursor : "pointer",
            display : "flex",
            alignItems : "center",
            justifyContent : "center",
            gap : "6px",
            whiteSpace : "nowrap",
        },

        // 현재 선택된 필터 컬럼 탭
        activeFilterTab : {
            backgroundColor : "var(--main-color)",
            color : "white",
        },

        // 선택된 체크박스 개수 배지
        filterCount : {
            minWidth : "18px",
            height : "18px",
            padding : "0 6px",
            borderRadius : "999px",
            backgroundColor : "#edf3ee",
            color : "var(--main-color)",
            fontSize : "12px",
            lineHeight : "18px",
            textAlign : "center",
        },

        // 선택된 탭 안의 개수 배지
        activeFilterCount : {
            backgroundColor : "rgba(255, 255, 255, 0.22)",
            color : "white",
        },

        // 선택된 필터 컬럼의 체크박스 목록 영역
        checkboxPanel : {
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "15px",
            backgroundColor : "#fffef7",
        },

        // 체크박스 목록의 제목 줄
        checkboxPanelHeader : {
            display : "flex",
            justifyContent : "space-between",
            alignItems : "center",
            gap : "12px",
            marginBottom : "12px",
        },

        // 체크박스 목록 제목
        checkboxPanelTitle : {
            fontSize : "15px",
            fontWeight : "800",
        },

        // 체크박스 선택 안내 문구
        checkboxPanelHint : {
            fontSize : "12px",
            color : "#666",
        },

        // 체크박스를 보기 좋게 나열하는 그리드
        checkboxGrid : {
            display : "grid",
            gridTemplateColumns : "repeat(auto-fit, minmax(150px, 1fr))",
            gap : "10px 18px",
        },

        // 체크박스 한 항목
        checkboxLabel : {
            display : "flex",
            alignItems : "center",
            gap : "8px",
            fontSize : "14px",
            cursor : "pointer",
            whiteSpace : "nowrap",
        },

        // 체크박스 입력
        checkboxInput : {
            width : "18px",
            height : "18px",
            margin : 0,
            accentColor : "var(--main-color)",
            cursor : "pointer",
        },

        // 옵션별 대상자 수
        checkboxCount : {
            color : "#666",
            fontSize : "13px",
        },

        // 체크박스 필터 아래 검색 입력 영역
        keywordSearchBox : {
            marginTop : "14px",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
            backgroundColor : "white",
        },

        // 검색어 입력 제목
        keywordLabel : {
            display : "block",
            marginBottom : "8px",
            fontSize : "13px",
            fontWeight : "700",
        },

        // 검색어 입력칸
        keywordInput : {
            width : "100%",
            height : "40px",
            boxSizing : "border-box",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "0 12px",
            fontSize : "14px",
            color : "var(--text-color)",
            backgroundColor : "white",
        },

        // 검색/초기화 버튼 정렬 영역
        filterActionRow : {
            display : "flex",
            justifyContent : "flex-end",
            gap : "8px",
            marginTop : "14px",
        },

        // 테이블 전체를 감싸는 흰색 영역
        tableBox : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            overflow : "hidden",
        },

        // 대상자 목록 테이블
        table : {
            width : "100%",
            borderCollapse : "collapse",
            fontSize : "14px",
        },

        // 테이블 제목 셀
        th : {
            textAlign : "center",
            backgroundColor : "#f7f5e8",
            padding : "12px 10px",
            borderBottom : "1px solid var(--border-color)",
            whiteSpace : "nowrap",
        },

        // 테이블 일반 셀
        td : {
            textAlign : "center",
            padding : "11px 10px",
            borderBottom : "1px solid var(--border-color)",
            verticalAlign : "middle",
        },

        // 대상자 이름 링크
        nameLink : {
            color : "var(--text-color)",
            fontWeight : "700",
            textDecoration : "none",
        },

        // 건강 상태와 복지사 판단 상태를 표시하는 작은 배지의 기본 스타일
        badge : {
            display : "inline-block",
            padding : "5px 9px",
            borderRadius : "999px",
            fontSize : "12px",
            fontWeight : "700",
            whiteSpace : "nowrap",
        },

        // 관리 버튼들을 한 줄에 정렬하기 위한 영역
        actionGroup : {
            display : "flex",
            flexWrap : "wrap",
            gap : "6px",
        },

        // 기본 버튼
        smallButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "none",
            cursor : "pointer",
            color : "white",
            backgroundColor : "var(--main-color)",
        },

        // 보류 버튼
        // 기본 버튼과 구분되도록 연한 배경과 테두리를 사용함
        holdButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "1px solid var(--main-color)",
            cursor : "pointer",
            color : "var(--text-color)",
            backgroundColor : "#f7f5e8",
        },

        // 부적합 버튼
        // 기존 메인 컬러와 너무 다르지 않게 톤을 낮춘 붉은색을 사용함
        dangerButton : {
            padding : "7px 10px",
            borderRadius : "8px",
            fontSize : "13px",
            border : "none",
            cursor : "pointer",
            color : "white",
            backgroundColor : "#b66b6b",
        },

        // 검색 버튼
        searchButton : {
            height : "38px",
            padding : "0 14px",
            borderRadius : "8px",
            border : "none",
            backgroundColor : "var(--main-color)",
            color : "white",
            cursor : "pointer",
        },

        // 초기화 버튼
        resetButton : {
            height : "38px",
            padding : "0 14px",
            borderRadius : "8px",
            border : "none",
            backgroundColor : "var(--main-color)",
            color : "white",
            cursor : "pointer",
        },

        // API 데이터 로딩/오류 안내 문구
        dataMessage : {
            margin : "0 0 12px",
            fontSize : "14px",
            color : "#666",
        },

        // 페이지 이동 버튼 영역
        pager : {
            display : "flex",
            flexWrap : "wrap",
            justifyContent : "center",
            gap : "6px",
            marginTop : "16px",
        },

        // 팝업 뒤쪽 어두운 배경
        modalBackdrop : {
            position : "fixed",
            inset : 0,
            backgroundColor : "rgba(0, 0, 0, 0.45)",
            display : "flex",
            justifyContent : "center",
            alignItems : "center",
            padding : "24px",
            zIndex : 100,
        },

        // 팝업 본문 박스
        modalBox : {
            width : "min(760px, 100%)",
            maxHeight : "85vh",
            overflowY : "auto",
            backgroundColor : "var(--bg-color)",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "22px",
            boxShadow : "0 20px 40px rgba(0, 0, 0, 0.25)",
        },

        // 팝업 제목과 닫기 버튼을 나란히 배치하는 영역
        modalHeader : {
            display : "flex",
            justifyContent : "space-between",
            alignItems : "start",
            gap : "12px",
            marginBottom : "16px",
        },

        // 팝업 제목
        modalTitle : {
            margin : 0,
            fontSize : "24px",
        },

        // 팝업 제목 아래 대상자 요약 문구
        modalSubText : {
            margin : "6px 0 0",
            color : "#666",
        },

        // 팝업 안의 상세정보 섹션들을 2열로 배치
        detailGrid : {
            display : "grid",
            gridTemplateColumns : "repeat(2, minmax(0, 1fr))",
            gap : "10px",
        },

        // 팝업 안의 각 정보 박스
        detailSection : {
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },

        // 상세정보 섹션 제목
        sectionTitle : {
            margin : "0 0 10px",
            fontSize : "16px",
        },

        // 상세정보 본문 텍스트
        detailText : {
            margin : "6px 0",
            fontSize : "14px",
        },

        // 상담 기록 박스
        memoBox : {
            marginTop : "12px",
            backgroundColor : "white",
            border : "1px solid var(--border-color)",
            borderRadius : "8px",
            padding : "14px",
        },
    };

    // 건강 상태와 복지사 판단 상태를 배지 색상으로 구분하는 함수
    // 화면 전체 색상은 기존 CSS 변수를 쓰고, 상태값만 알아보기 쉽게 은은하게 구분함
    const getBadgeStyle = (type, value) => {
        const badgeColors = {
            // 건강 상태 배지 색상
            health : {
                "양호" : { backgroundColor : "rgba(134, 167, 136, 0.22)", color : "#48644b" },
                "주의" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "위험" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },

            // 복지사 판단 배지 색상
            decision : {
                "미검토" : { backgroundColor : "#eeeeee", color : "#555" },
                "적합" : { backgroundColor : "#dff3ff", color : "#176b92" },
                "보류" : { backgroundColor : "#fff3c4", color : "#6b5b12" },
                "부적합" : { backgroundColor : "#ffe1e1", color : "#8a2f2f" },
            },
        };

        return {
            ...styles.badge,
            ...(badgeColors[type]?.[value] || {
                backgroundColor : "#eeeeee",
                color : "#555",
            }),
        };
    };

    const formatAgeGender = (senior) => {
        const ageText = senior.age == null ? "나이 미입력" : `${senior.age}세`;
        const genderText = senior.gender || "성별 미입력";

        return `${ageText} / ${genderText}`;
    };

    // return 안에 작성한 JSX가 실제 화면에 표시됨
    return (
        <div style = {styles.page}>
            <header style = {styles.topHeader}>
                <div style = {styles.brandArea}>
                    <div style = {styles.logoBox}>우리</div>
                    <strong style = {styles.serviceName}>우리</strong>
                    <span style = {styles.headerPageName}>복지사 대상자 관리</span>
                </div>
            </header>

            <div style = {styles.content}>
            {/* 상단 요약 카드 영역 */}
            {/* 기존 문장형 현황 표시를 카드형으로 바꿔서 중요한 수치를 먼저 보여줌 */}
            <div style = {styles.summaryGrid}>
                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>전체 대상자</p>
                    <p style = {styles.summaryValue}>{summaryCounts.total}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>필터 결과</p>
                    <p style = {styles.summaryValue}>{summaryCounts.filtered}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>건강 위험</p>
                    <p style = {styles.summaryValue}>{summaryCounts.danger}명</p>
                </div>

                <div style = {styles.summaryBox}>
                    <p style = {styles.summaryLabel}>알림 있음</p>
                    <p style = {styles.summaryValue}>{summaryCounts.alert}명</p>
                </div>
            </div>

            {/* 필터 선택 영역 */}
            {/* 복지사가 건강 상태, 위치 상태, 알림 상태, 일자리 상태, 판단 상태별로 대상자를 걸러볼 수 있음 */}
            <div style = {styles.filterBox}>
                <div style = {styles.filterTabs}>
                    {FILTER_GROUPS.map((group, index) => {
                        const isActive = activeFilterKey === group.key;
                        const selectedCount = draftFilters[group.key].length;

                        return (
                            <button
                                type = "button"
                                key = {group.key}
                                style = {{
                                    ...styles.filterTab,
                                    borderRight : index === FILTER_GROUPS.length - 1
                                        ? "none"
                                        : "1px solid var(--border-color)",
                                    ...(isActive ? styles.activeFilterTab : {}),
                                }}
                                onClick = {() => {
                                    setActiveFilterKey(group.key);
                                }}
                            >
                                <span>{group.label}</span>
                                {selectedCount > 0 && (
                                    <span
                                        style = {{
                                            ...styles.filterCount,
                                            ...(isActive ? styles.activeFilterCount : {}),
                                        }}
                                    >
                                        {selectedCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div style = {styles.checkboxPanel}>
                    <div style = {styles.checkboxPanelHeader}>
                        <strong style = {styles.checkboxPanelTitle}>
                            {activeFilterGroup.label}
                        </strong>
                        <span style = {styles.checkboxPanelHint}>
                            선택하지 않으면 전체가 표시됩니다.
                        </span>
                    </div>

                    <div style = {styles.checkboxGrid}>
                        {activeFilterGroup.options.map((option) => (
                            <label
                                key = {option}
                                style = {styles.checkboxLabel}
                            >
                                <input
                                    type = "checkbox"
                                    checked = {draftFilters[activeFilterGroup.key].includes(option)}
                                    onChange = {() => {
                                        toggleDraftFilter(activeFilterGroup.key, option);
                                    }}
                                    style = {styles.checkboxInput}
                                />
                                <span>{option}</span>
                                <span style = {styles.checkboxCount}>
                                    ({getFilterOptionCount(activeFilterGroup.key, option)})
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div style = {styles.keywordSearchBox}>
                    <label
                        htmlFor = "senior-keyword-search"
                        style = {styles.keywordLabel}
                    >
                        검색어
                    </label>
                    <input
                        id = "senior-keyword-search"
                        type = "search"
                        value = {draftSearchKeyword}
                        placeholder = "이름, 거주 지역, 상태 검색"
                        style = {styles.keywordInput}
                        onChange = {(event) => {
                            setDraftSearchKeyword(event.target.value);
                        }}
                        onKeyDown = {(event) => {
                            if (event.key === "Enter") {
                                applyFilters();
                            }
                        }}
                    />
                </div>

                <div style = {styles.filterActionRow}>
                    {/* 검색 버튼 */}
                    {/* 체크박스에서 고른 임시 필터 값과 검색어를 실제 게시판에 적용함 */}
                    <button
                        type = "button"
                        style = {styles.searchButton}
                        onClick = {applyFilters}
                    >
                        검색
                    </button>

                    {/* 초기화 버튼 */}
                    {/* 선택된 필터와 적용된 필터를 모두 전체로 되돌림 */}
                    <button
                        type = "button"
                        style = {styles.resetButton}
                        onClick = {resetFilters}
                    >
                        초기화
                    </button>
                </div>
            </div>

            {isLoadingSeniors && (
                <p style = {styles.dataMessage}>대상자 데이터를 불러오는 중입니다.</p>
            )}

            {seniorLoadError && (
                <p style = {{ ...styles.dataMessage, color : "#b66b6b" }}>
                    {seniorLoadError}
                </p>
            )}

            {/* 대상자 목록을 표 형태로 보여주는 영역 */}
            <div style = {styles.tableBox}>
                <table style = {styles.table}>
                    {/* thead는 표의 제목 행을 의미함 */}
                    <thead>
                        <tr>
                            <th style = {styles.th}>이름</th>
                            <th style = {styles.th}>나이/성별</th>
                            <th style = {styles.th}>거주 지역</th>
                            <th style = {styles.th}>건강 상태</th>
                            <th style = {styles.th}>마지막 접속 시간</th>
                            <th style = {styles.th}>위치 상태</th>
                            <th style = {styles.th}>알림 상태</th>
                            <th style = {styles.th}>일자리 매칭 상태</th>
                            <th style = {styles.th}>복지사 판단</th>
                        </tr>
                    </thead>

                    {/* tbody는 실제 데이터가 들어가는 표의 본문 영역 */}
                    <tbody>
                        {/* currentSeniors를 사용해서 현재 페이지의 10명만 출력 */}
                        {currentSeniors.map((senior) => (
                            // key는 React가 각 행을 구분하기 위해 사용하는 값
                            // 보통 데이터의 id를 사용함
                            <tr key = {senior.id}>
                                {/* 대상자 이름 출력 */}
                                <td style = {styles.td}>
                                    <Link
                                        to = {`/welfare/seniors/${senior.id}`}
                                        style = {styles.nameLink}
                                    >
                                        {senior.name}
                                    </Link>
                                </td>

                                {/* 나이와 성별을 함께 출력 */}
                                <td style = {styles.td}>
                                    {formatAgeGender(senior)}
                                </td>

                                {/* 거주 지역 출력 */}
                                <td style = {styles.td}>{senior.region}</td>

                                {/* 건강 상태 출력 */}
                                {/* 색상 배지로 표시해서 양호 / 주의 / 위험을 빠르게 구분함 */}
                                <td style = {styles.td}>
                                    <span style = {getBadgeStyle("health", senior.healthStatus)}>
                                        {senior.healthStatus}
                                    </span>
                                </td>

                                {/* 마지막 접속 시간 출력 */}
                                <td style = {styles.td}>{senior.lastAccess}</td>

                                {/* 위치 상태 출력 */}
                                <td style = {styles.td}>{senior.locationStatus}</td>

                                {/* 알림 상태 출력 */}
                                <td style = {styles.td}>{senior.alertStatus}</td>

                                {/* 일자리 매칭 상태 출력 */}
                                <td style = {styles.td}>{senior.jobStatus}</td>

                                {/* 복지사가 직접 선택한 판단 결과 */}
                                {/* 처음에는 "미검토", 버튼 클릭 후 "적합" / "보류" / "부적합"으로 바뀜 */}
                                <td style = {styles.td}>
                                    <span style = {getBadgeStyle("decision", senior.welfareDecision)}>
                                        {senior.welfareDecision}
                                    </span>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 페이지 이동 버튼 영역 */}
            <div style = {styles.pager}>
                <button
                    type = "button"
                    style = {styles.smallButton}
                    onClick = {goToPrevPage}
                    disabled = {currentPage === 1}
                >
                    이전
                </button>

                {Array.from({ length : totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                        type = "button"
                        key = {pageNumber}
                        style = {{
                            ...styles.smallButton,
                            opacity : currentPage === pageNumber ? 0.6 : 1,
                        }}
                        onClick = {() => goToPage(pageNumber)}
                        disabled = {currentPage === pageNumber}
                    >
                        {pageNumber}
                    </button>
                ))}

                <button
                    type = "button"
                    style = {styles.smallButton}
                    onClick = {goToNextPage}
                    disabled = {currentPage === totalPages}
                >
                    다음
                </button>
            </div>
            </div>

        </div>
    );
}

// 다른 파일(App.jsx 등)에서 WelfareDashboard 컴포넌트를 사용할 수 있도록 내보내기
// App.jsx에서 import 해서 화면에 표시할 수 있음
export default WelfareDashboard;
