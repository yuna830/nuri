// WelfareDashboard 컴포넌트
// 복지사가 담당 노인들의 상태를 한눈에 확인할 수 있는 대상자 관리 페이지
function WelfareDashboard(){
    // seniors 배열
    // 복지사가 관리하는 노인 대상자들의 임시 데이터
    // 나중에는 이 데이터를 백엔드(Spring Boot)나 DB(MySQL)에서 받아오게 됨
    const seniors = [
        {
            id : 1, // 대상자를 구분하기 위한 고유 번호
            name : "김ㅇㅇ", // 대상자 이름
            age : 76, // 나이
            gender : "여성", // 성별
            region : "서울시 강서구 화곡동", // 거주 지역
            healthStatus : "주의", // 건강 상태 : 양호 / 주의 / 위험
            lastAccess : "10분 전", // 마지막으로 서비스에 접속한 시간
            locationStatus : "정상", // 위치 상태 : 정상 / 안전구역 이탈
            alertStatus : "없음", // 알림 상태 : 없음 / 응급 알림 등
            jobStatus : "추천 완료", // 일자리 매칭 상태 : 추천 완료 / 지원 중 / 미추천
        },

        {
            id : 2,
            name : "박ㅇㅇ",
            age : 82,
            gender : "남성",
            region : "서울시 양천구 신월동",
            healthStatus : "위험",
            lastAccess : "1시간 전",
            locationStatus : "안전구역 이탈",
            alertStatus : "응급 알림",
            jobStatus : "지원 중",
        },

        {
            id : 3,
            name : "이ㅇㅇ",
            age : 74,
            gender : "여성",
            region : "서울시 강서구 등촌동",
            healthStatus : "양호",
            lastAccess : "30분 전",
            locationStatus : "정상",
            alertStatus : "없음",
            jobStatus : "미추천",
        },
    ];

    // return 안에 작성한 JSX가 실제 화면에 표시됨
    return (
        <div>
            {/* 페이지 제목 */}
            <h1>복지사 대상자 관리</h1>

            {/* 대상자 목록을 표 형태로 보여주는 영역 */}
            <table border = "1">
                {/* thead는 표의 제목 행을 의미함 */}
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>나이/성별</th>
                        <th>거주 지역</th>
                        <th>건강 상태</th>
                        <th>최근 접속 시간</th>
                        <th>위치 상태</th>
                        <th>알림 상태</th>
                        <th>일자리 매칭 상태</th>
                        <th>관리</th>
                    </tr>
                </thead>

                {/* tbody는 실제 데이터가 들어가는 표의 본문 영역 */}
                <tbody>
                    {/* 
                        seniors.map()
                        seniors 배열에 들어 있는 대상자 수만큼 tr 태그를 반복 생성함
                        
                        Ex) seniors에 3명이 있으면 표의 행도 3개가 만들어짐
                    */}
                    {seniors.map((senior) => (
                        // key는 React가 각 행을 구분하기 위해 사용하는 값
                        // 보통 데이터의 id를 사용함
                        <tr key = {senior.id}>
                            {/* 대상자 이름 출력 */}
                            <td>{senior.name}</td>

                            {/* 나이와 성별을 함께 출력 */}
                            <td>
                                {senior.age}세 / {senior.gender}
                            </td>

                            {/* 거주 지역 출력 */}
                            <td>{senior.region}</td>

                            {/* 건강 상태 출력 */}
                            <td>{senior.healthStatus}</td>

                            {/* 최근 접속 시간 출력 */}
                            <td>{senior.lastAccess}</td>

                            {/* 위치 상태 출력 */}
                            <td>{senior.locationStatus}</td>

                            {/* 알림 상태 출력 */}
                            <td>{senior.alertStatus}</td>

                            {/* 일자리 매칭 상태 출력 */}
                            <td>{senior.jobStatus}</td>

                            {/* 관리 버튼 영역 */}
                            <td>
                                {/* 나중에 클릭하면 대상자 상세 정보 페이지로 이동하거나 상세 내용을 보여줄 예정 */}
                                <button>상세보기</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    
}
// 다른 파일(App.jsx 등)에서 WelfareDashboard 컴포넌트를 사용할 수 있도록 내보내기
export default WelfareDashboard;
