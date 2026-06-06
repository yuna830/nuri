import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/senior_api.dart';

// ─── Constants ──────────────────────────────────────────────────────────────

const _categories = [
  _Category('전체', ''),
  _Category('환경미화', '환경미화'),
  _Category('경비·보안', '경비'),
  _Category('요양·돌봄', '요양'),
  _Category('사무보조', '사무보조'),
  _Category('생산·제조', '생산'),
  _Category('운전·배달', '운전'),
  _Category('조리·식품', '조리'),
  _Category('물류·유통', '물류'),
  _Category('기타', '기타'),
];

const _categoryKeywords = <String, List<String>>{
  '환경미화': ['미화', '청소', '환경', '위생'],
  '경비': ['경비', '보안', '안전', '주차'],
  '요양': ['요양', '돌봄', '간병', '보호', '케어'],
  '사무보조': ['사무', '행정', '전산', '문서', '보조'],
  '생산': ['생산', '제조', '공장', '조립', '포장'],
  '운전': ['운전', '배송', '배달', '운송'],
  '조리': ['조리', '급식', '식당', '주방', '음식'],
  '물류': ['물류', '유통', '매장', '판매', '계산'],
};

const _emplMap = <String, String>{
  'CM0101': '정규직',
  'CM0102': '계약직',
  'CM0103': '시간제',
  'CM0104': '일당직',
  'CM0105': '기타',
  'J01101': '상용직',
  'J01102': '계약직',
  'J01103': '계약직 시간제',
  'J01105': '상용직 시간제',
};

class _Category {
  const _Category(this.label, this.value);
  final String label;
  final String value;
}

// ─── helpers ────────────────────────────────────────────────────────────────

String _fmtDate(dynamic v) {
  if (v == null || v.toString().isEmpty) return '';
  final s = v.toString();
  if (s.length == 8) {
    return '${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}';
  }
  try {
    final dt = DateTime.parse(s);
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  } catch (_) {
    return s;
  }
}

bool _isExpired(Map<String, dynamic> job) {
  final toDd = job['toDd']?.toString() ?? '';
  if (toDd.isEmpty) return job['deadline']?.toString() == '마감';
  try {
    final end = DateTime.parse(
      toDd.length == 8
          ? '${toDd.substring(0, 4)}-${toDd.substring(4, 6)}-${toDd.substring(6, 8)}'
          : toDd,
    );
    return end.isBefore(DateTime.now().subtract(const Duration(days: 1)));
  } catch (_) {
    return false;
  }
}

String _categorize(Map<String, dynamic> job) {
  final text = [
    job['recrtTitle'], job['jobclsNm'], job['detCnts'], job['workPlcNm']
  ].whereType<String>().join(' ').toLowerCase();

  for (final entry in _categoryKeywords.entries) {
    if (entry.value.any((kw) => text.contains(kw))) return entry.key;
  }
  return '기타';
}

int _matchScore(Map<String, dynamic> job, Map<String, dynamic> profile, String category) {
  int score = 0;
  final jobText = '${job['recrtTitle'] ?? ''} ${job['jobclsNm'] ?? ''} ${job['workPlcNm'] ?? ''}'.toLowerCase();

  // 카테고리 일치
  if (category.isNotEmpty && _categorize(job) == category) score += 25;

  // 지역 일치
  final region = '${profile['region'] ?? ''}'.toLowerCase();
  if (region.isNotEmpty) {
    final parts = region.split(' ');
    if (parts.any((p) => p.isNotEmpty && jobText.contains(p))) score += 20;
  }

  // 희망 직종
  final hopeJobType = profile['hopeJobType'];
  if (hopeJobType is List) {
    for (final t in hopeJobType) {
      if (jobText.contains('$t'.toLowerCase())) {
        score += 15;
        break;
      }
    }
  }

  // 마감 여부 (마감 안 된 공고 선호)
  if (!_isExpired(job)) score += 5;

  return score.clamp(0, 100);
}

// ─── screen ──────────────────────────────────────────────────────────────────

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class JobScreen extends StatefulWidget {
  const JobScreen({
    super.key,
    required this.seniorId,
    this.hideAppBar = false,
    this.onRegisterAction,
  });
  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;

  @override
  State<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends State<JobScreen> {
  final _api = const SeniorApi();
  final _searchCtrl = TextEditingController();

  List<Map<String, dynamic>> _jobs = [];
  List<Map<String, dynamic>> _applications = [];
  Map<String, dynamic> _profile = {};
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String _category = '';
  String _search = '';
  bool _hideExpired = true;
  int _visibleCount = 20;
  int _loadedPage = 0;
  int _totalCount = 0;
  bool _hasMoreSource = true;
  Timer? _appTimer;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _appTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadApplications());
    widget.onRegisterAction?.call(
      action: _showApplications,
      icon: Icons.list_alt_outlined,
      tooltip: '신청 내역',
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _appTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadAll() async {
    await Future.wait([_loadJobs(replace: true), _loadApplications(), _loadProfile()]);
  }

  Future<void> _loadProfile() async {
    try {
      final raw = await _api.fetchProfile(widget.seniorId);
      final s = raw['senior'] as Map<String, dynamic>? ?? {};
      final h = raw['healthInfo'] as Map<String, dynamic>? ?? {};
      final j = raw['jobPreference'] as Map<String, dynamic>? ?? {};

      List<String> parseList(dynamic v) {
        if (v == null) return [];
        if (v is List) return v.map((e) => '$e').toList();
        final str = '$v'.trim();
        if (str.isEmpty || str == '[]') return [];
        return str.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
      }

      // senior + healthInfo + jobPreference 합쳐서 profile로 사용
      final merged = {
        ...s,
        'region': s['region'] ?? s['address'] ?? '',
        'maxHours': h['maxHours'] ?? '',
        'maxDistance': h['maxDistance'] ?? '',
        'restNeed': h['restNeed'] ?? '',
        'avoidEnvironment': parseList(h['avoidEnvironment']),
        'disabledWork': parseList(h['disabledWork']),
        'payType': j['payType'] ?? '',
        'hopeDays': parseList(j['hopeDays']),
        'hopeJobType': parseList(j['hopeJobType']),
        'hopeCondition': parseList(j['hopeCondition']),
      };
      if (mounted) setState(() => _profile = merged);
    } catch (_) {}
  }

  Future<void> _loadApplications() async {
    try {
      final list = await _api.fetchJobApplications(widget.seniorId);
      if (mounted) {
        setState(() => _applications = list.whereType<Map<String, dynamic>>().toList());
      }
    } catch (_) {}
  }

  Future<void> _loadJobs({bool replace = false, int startPage = 1}) async {
    if (_loadingMore) return;
    setState(() {
      _loading = replace;
      _loadingMore = !replace;
      _error = null;
    });

    try {
      int page = startPage;
      final merged = <String, Map<String, dynamic>>{};
      if (!replace) {
        for (final j in _jobs) {
          merged['${j['source']}-${j['jobId']}'] = j;
        }
      }
      int total = _totalCount;
      bool cont = true;

      while (cont) {
        final result = await _api.fetchJobList(page: page, size: 100);
        final list = (result['list'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        total = (result['total'] as num?)?.toInt() ?? total;

        for (final j in list) {
          merged['${j['source']}-${j['jobId']}'] = j;
        }

        final filtered = _applyFilters(merged.values.toList());
        final enough = filtered.length >= _visibleCount + 5;
        final loadedAll = total > 0 && merged.length >= total;
        // total==0이고 list가 비어있으면 더 이상 데이터 없음
        final noMoreData = list.isEmpty || (total == 0 && list.length < 100);
        cont = !enough && !loadedAll && !noMoreData && page < 15;
        page++;
      }

      if (mounted) {
        setState(() {
          _jobs = merged.values.toList();
          _totalCount = total;
          _loadedPage = page - 1;
          _hasMoreSource = total <= 0 || _jobs.length < total;
          _loading = false;
          _loadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '일자리 정보를 불러오지 못했습니다.';
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> list) {
    return list.where((job) {
      if (_hideExpired && _isExpired(job)) return false;
      if (_category.isNotEmpty && _categorize(job) != _category) return false;
      if (_search.isNotEmpty) {
        final kw = _search.toLowerCase();
        final text = [
          job['recrtTitle'], job['oranNm'], job['workPlcNm'], job['jobclsNm'], job['source']
        ].whereType<String>().join(' ').toLowerCase();
        if (!text.contains(kw)) return false;
      }
      return true;
    }).toList();
  }

  int get _interestCount => _applications
      .where((a) =>
          (a['applicationType'] == 'INTEREST' || a['status'] == '관심 있음') &&
          !['관심 삭제', '삭제', '취소'].contains(a['status']))
      .length;

  int get _appliedCount => _applications
      .where((a) => !['INTEREST', 'RECOMMEND'].contains(a['applicationType']))
      .length;

  void _showInterestJobs() {
    final interested = _applications
        .where((a) =>
            (a['applicationType'] == 'INTEREST' || a['status'] == '관심 있음') &&
            !['관심 삭제', '삭제', '취소'].contains(a['status']))
        .toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _InterestSheet(
        applications: interested,
        onDelete: (id) async {
          await _api.updateJobApplicationStatus(id, '관심 삭제');
          await _loadApplications();
        },
        onApply: (id) async {
          await _api.updateJobApplicationStatus(id, '검토 대기');
          await _loadApplications();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('신청했어요.'), backgroundColor: Color(0xFF86A788)),
            );
          }
        },
      ),
    );
  }

  List<Map<String, dynamic>> get _scored {
    final filtered = _applyFilters(_jobs);
    final result = filtered
        .map((j) => {...j, '__score': _matchScore(j, _profile, _category)})
        .toList()
      ..sort((a, b) => (b['__score'] as int).compareTo(a['__score'] as int));
    return result;
  }

  Future<void> _apply(Map<String, dynamic> job) async {
    try {
      await _api.applyJob(
        seniorId: widget.seniorId,
        job: job,
        applicationType: 'ONLINE',
        status: '검토 대기',
      );
      await _loadApplications();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('복지사에게 일자리 신청을 보냈어요.'),
          backgroundColor: Color(0xFF86A788),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('신청에 실패했습니다.'),
          backgroundColor: Color(0xFFD94E4E),
        ),
      );
    }
  }

  Future<void> _interest(Map<String, dynamic> job) async {
    try {
      await _api.applyJob(
        seniorId: widget.seniorId,
        job: job,
        applicationType: 'INTEREST',
        status: '관심 있음',
      );
      await _loadApplications();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('복지사에게 관심 공고를 전달했어요.'),
          backgroundColor: Color(0xFF86A788),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('전달에 실패했습니다.'),
          backgroundColor: Color(0xFFD94E4E),
        ),
      );
    }
  }

  void _showJobDetail(BuildContext context, Map<String, dynamic> job) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _JobDetailSheet(
        job: job,
        profile: _profile,
        category: _category,
        onApply: () {
          Navigator.pop(context);
          _apply(job);
        },
        onInterest: () {
          Navigator.pop(context);
          _interest(job);
        },
      ),
    );
  }

  void _showApplications() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ApplicationsSheet(
        applications: _applications,
        onStatusChanged: (id, status) async {
          await _api.updateJobApplicationStatus(id, status);
          await _loadApplications();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scored = _scored;
    final recommended = scored.take(5).toList();
    final recommendedKeys = recommended.map((j) => '${j['source']}-${j['jobId']}').toSet();
    final listed = scored.where((j) => !recommendedKeys.contains('${j['source']}-${j['jobId']}')).toList();
    final visible = listed.take(_visibleCount).toList();
    final hasMore = listed.length > _visibleCount || _hasMoreSource;

    final welfareRecommended = _applications
        .where((a) =>
            a['applicationType'] == 'RECOMMEND' &&
            !['관심 있음', '문의 요청', '거절', '처리 완료', '승인', '반려']
                .contains(a['status']))
        .toList();
    final applied = _applications
        .where((a) => !['INTEREST', 'RECOMMEND'].contains(a['applicationType']))
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F5),
      appBar: widget.hideAppBar
          ? null
          : AppBar(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              elevation: 0,
              title: const Text(
                '일자리',
                style: TextStyle(
                    color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
              ),
              actions: [
                if (applied.isNotEmpty)
                  TextButton.icon(
                    onPressed: _showApplications,
                    icon: const Icon(Icons.list_alt_outlined,
                        size: 18, color: Color(0xFF86A788)),
                    label: Text('신청 ${applied.length}건',
                        style: const TextStyle(
                            color: Color(0xFF86A788),
                            fontWeight: FontWeight.w800)),
                  ),
              ],
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF86A788)))
          : Column(children: [
              _SearchBar(
                controller: _searchCtrl,
                hideExpired: _hideExpired,
                onSearch: (v) => setState(() {
                  _search = v;
                  _visibleCount = 20;
                }),
                onToggleExpired: (v) => setState(() {
                  _hideExpired = v;
                  _visibleCount = 20;
                }),
              ),
              _CategoryChips(
                selected: _category,
                onChanged: (v) => setState(() {
                  _category = v;
                  _visibleCount = 20;
                }),
              ),
              // 관심공고 / 신청공고 버튼
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Row(children: [
                  Expanded(child: _ShortcutCard(
                    icon: Icons.bookmark_rounded,
                    label: '관심공고',
                    count: _interestCount,
                    color: const Color(0xFF86A788),
                    onTap: _showInterestJobs,
                  )),
                  const SizedBox(width: 10),
                  Expanded(child: _ShortcutCard(
                    icon: Icons.send_rounded,
                    label: '신청공고',
                    count: _appliedCount,
                    color: const Color(0xFF4C9ED9),
                    onTap: _showApplications,
                  )),
                ]),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD94E4E).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('⚠️ $_error',
                        style: const TextStyle(color: Color(0xFFD94E4E), fontSize: 13)),
                  ),
                ),
              Expanded(
                child: RefreshIndicator(
                  color: const Color(0xFF86A788),
                  onRefresh: () => _loadJobs(replace: true),
                  child: CustomScrollView(
                    slivers: [
                      // 복지사 추천 공고
                      if (welfareRecommended.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _WelfareRecommendSection(applications: welfareRecommended),
                        ),
                      // 내 프로필 조건
                      if (_profile.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _ProfileConditionCard(profile: _profile),
                        ),
                      // 맞춤 추천
                      if (recommended.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _RecommendSection(
                            jobs: recommended,
                            onTap: (j) => _showJobDetail(context, j),
                          ),
                        ),
                      // 공고 목록
                      if (scored.isEmpty && !_loadingMore)
                        const SliverFillRemaining(
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('🔍', style: TextStyle(fontSize: 40)),
                                SizedBox(height: 12),
                                Text('해당하는 일자리가 없습니다',
                                    style: TextStyle(
                                        color: Color(0xFF6D766A),
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        )
                      else ...[
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                          sliver: SliverToBoxAdapter(
                            child: Text(
                              '전체 공고 ${scored.length}건${_hasMoreSource ? '+' : ''}',
                              style: const TextStyle(
                                  color: Color(0xFF6D766A),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (ctx, i) => _JobCard(
                                job: visible[i],
                                onTap: _isExpired(visible[i])
                                    ? null
                                    : () => _showJobDetail(context, visible[i]),
                              ),
                              childCount: visible.length,
                            ),
                          ),
                        ),
                        if (hasMore)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: _loadingMore
                                  ? const Center(
                                      child: CircularProgressIndicator(
                                          color: Color(0xFF86A788)))
                                  : OutlinedButton(
                                      onPressed: () async {
                                        setState(() => _visibleCount += 20);
                                        if (listed.length < _visibleCount &&
                                            _hasMoreSource) {
                                          await _loadJobs(
                                              startPage: _loadedPage + 1);
                                        }
                                      },
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(
                                            color: Color(0xFF86A788)),
                                        foregroundColor: const Color(0xFF86A788),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(10)),
                                      ),
                                      child: Text(
                                        '더보기 (${visible.length + recommended.length} / ${scored.length}${_hasMoreSource ? '+' : ''}건)',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800),
                                      ),
                                    ),
                            ),
                          ),
                      ],
                      const SliverToBoxAdapter(child: SizedBox(height: 32)),
                    ],
                  ),
                ),
              ),
            ]),
    );
  }
}

// ─── ShortcutCard ────────────────────────────────────────────────────────────

class _ShortcutCard extends StatelessWidget {
  const _ShortcutCard({
    required this.icon,
    required this.label,
    required this.count,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final int count;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  color: color, fontSize: 13, fontWeight: FontWeight.w800)),
          if (count > 0) ...[
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
          ],
        ]),
      ),
    );
  }
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.hideExpired,
    required this.onSearch,
    required this.onToggleExpired,
  });
  final TextEditingController controller;
  final bool hideExpired;
  final ValueChanged<String> onSearch;
  final ValueChanged<bool> onToggleExpired;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            onChanged: onSearch,
            decoration: InputDecoration(
              hintText: '공고명, 기업명, 근무지 검색...',
              prefixIcon: const Icon(Icons.search, color: Color(0xFF86A788)),
              suffixIcon: controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        controller.clear();
                        onSearch('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFFF7F5E8),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => onToggleExpired(!hideExpired),
          child: Row(children: [
            SizedBox(
              width: 20,
              height: 20,
              child: Checkbox(
                value: hideExpired,
                onChanged: (v) => onToggleExpired(v ?? true),
                activeColor: const Color(0xFF86A788),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            const SizedBox(width: 4),
            const Text('마감 숨기기',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
        ),
      ]),
    );
  }
}

// ─── CategoryChips ────────────────────────────────────────────────────────────

class _CategoryChips extends StatefulWidget {
  const _CategoryChips({required this.selected, required this.onChanged});
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  State<_CategoryChips> createState() => _CategoryChipsState();
}

class _CategoryChipsState extends State<_CategoryChips> {
  final _scrollCtrl = ScrollController();
  final _keys = List.generate(_categories.length, (_) => GlobalKey());

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _shift(int direction) {
    final currentIndex = _categories.indexWhere((c) => c.value == widget.selected);
    final nextIndex = (currentIndex + direction).clamp(0, _categories.length - 1);
    if (nextIndex == currentIndex) return;
    widget.onChanged(_categories[nextIndex].value);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _keys[nextIndex].currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(ctx,
            alignment: 0.1,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _categories.indexWhere((c) => c.value == widget.selected);
    final canPrev = currentIndex > 0;
    final canNext = currentIndex < _categories.length - 1;

    return Container(
      color: Colors.white,
      height: 44,
      child: Row(children: [
        // 이전 버튼
        GestureDetector(
          onTap: canPrev ? () => _shift(-1) : null,
          child: Container(
            width: 32,
            alignment: Alignment.center,
            child: Icon(Icons.chevron_left,
                size: 20,
                color: canPrev ? const Color(0xFF86A788) : const Color(0xFFCCCCCC)),
          ),
        ),
        // 칩 목록
        Expanded(
          child: ListView.separated(
            controller: _scrollCtrl,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(vertical: 6),
            itemCount: _categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (_, i) {
              final cat = _categories[i];
              final active = widget.selected == cat.value;
              return GestureDetector(
                key: _keys[i],
                onTap: () => widget.onChanged(cat.value),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFF86A788) : const Color(0xFFF7F5E8),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    cat.label,
                    style: TextStyle(
                      color: active ? Colors.white : const Color(0xFF1F2A20),
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        // 다음 버튼
        GestureDetector(
          onTap: canNext ? () => _shift(1) : null,
          child: Container(
            width: 32,
            alignment: Alignment.center,
            child: Icon(Icons.chevron_right,
                size: 20,
                color: canNext ? const Color(0xFF86A788) : const Color(0xFFCCCCCC)),
          ),
        ),
      ]),
    );
  }
}

// ─── 복지사 추천 ────────────────────────────────────────────────────────────

class _WelfareRecommendSection extends StatelessWidget {
  const _WelfareRecommendSection({required this.applications});
  final List<Map<String, dynamic>> applications;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3E2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF0B429).withValues(alpha: 0.4)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('🌟 복지사가 추천한 공고',
              style: TextStyle(
                  color: Color(0xFF92400E),
                  fontSize: 14,
                  fontWeight: FontWeight.w900)),
          const Spacer(),
          Text('${applications.length}건',
              style: const TextStyle(
                  color: Color(0xFF92400E), fontSize: 13, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 4),
        const Text('관심 여부를 누르면 복지사에게 바로 전달됩니다.',
            style: TextStyle(color: Color(0xFF78350F), fontSize: 12)),
        const SizedBox(height: 8),
        ...applications.take(3).map((a) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Expanded(
                  child: Text(
                    a['jobTitle']?.toString() ?? '추천 공고',
                    style: const TextStyle(
                        color: Color(0xFF92400E),
                        fontSize: 13,
                        fontWeight: FontWeight.w800),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  a['status']?.toString() ?? '확인 대기',
                  style: const TextStyle(
                      color: Color(0xFF78350F), fontSize: 12),
                ),
              ]),
            )),
      ]),
    );
  }
}

// ─── 내 희망 조건 카드 (접기/펼치기) ──────────────────────────────────────────

class _ProfileConditionCard extends StatefulWidget {
  const _ProfileConditionCard({required this.profile});
  final Map<String, dynamic> profile;

  @override
  State<_ProfileConditionCard> createState() => _ProfileConditionCardState();
}

class _ProfileConditionCardState extends State<_ProfileConditionCard> {
  bool _expanded = false;

  String _listStr(dynamic v) {
    if (v is List) return v.join(' · ');
    return '$v';
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;

    // 항상 보이는 조건
    final basic = <String, String>{};
    if ((p['region'] as String? ?? '').isNotEmpty) basic['거주지'] = p['region'];
    if ((p['payType'] as String? ?? '').isNotEmpty) basic['급여형태'] = p['payType'];
    if ((p['maxHours'] as String? ?? '').isNotEmpty) basic['활동시간'] = p['maxHours'];
    if ((p['maxDistance'] as String? ?? '').isNotEmpty) basic['이동거리'] = p['maxDistance'];

    // 더보기 조건
    final extra = <String, String>{};
    final hopeDays = p['hopeDays'];
    if (hopeDays is List && hopeDays.isNotEmpty) extra['희망요일'] = _listStr(hopeDays);
    final hopeJobType = p['hopeJobType'];
    if (hopeJobType is List && hopeJobType.isNotEmpty) extra['희망직종'] = _listStr(hopeJobType);
    final hopeCondition = p['hopeCondition'];
    if (hopeCondition is List && hopeCondition.isNotEmpty) extra['희망조건'] = _listStr(hopeCondition);
    final restNeed = p['restNeed'] as String? ?? '';
    if (restNeed.isNotEmpty && restNeed != '없음') extra['휴식'] = restNeed;
    final avoid = p['avoidEnvironment'];
    if (avoid is List && avoid.isNotEmpty) extra['피할환경'] = _listStr(avoid);

    if (basic.isEmpty && extra.isEmpty) return const SizedBox.shrink();

    final displayed = _expanded ? {...basic, ...extra} : basic;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F7F0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF86A788).withValues(alpha: 0.3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('내 희망 조건',
              style: TextStyle(
                  color: Color(0xFF2D5A2E),
                  fontSize: 13,
                  fontWeight: FontWeight.w900)),
          const Spacer(),
          if (extra.isNotEmpty)
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Text(
                _expanded ? '접기 ▲' : '더보기 ▼',
                style: const TextStyle(
                    color: Color(0xFF86A788),
                    fontSize: 12,
                    fontWeight: FontWeight.w700),
              ),
            ),
        ]),
        const SizedBox(height: 6),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: displayed.entries
              .map((e) => RichText(
                    text: TextSpan(children: [
                      TextSpan(
                        text: '${e.key}: ',
                        style: const TextStyle(
                            color: Color(0xFF6D766A),
                            fontSize: 12,
                            fontWeight: FontWeight.w700),
                      ),
                      TextSpan(
                        text: e.value,
                        style: const TextStyle(
                            color: Color(0xFF1F2A20),
                            fontSize: 12,
                            fontWeight: FontWeight.w800),
                      ),
                    ]),
                  ))
              .toList(),
        ),
      ]),
    );
  }
}

// ─── 맞춤 추천 ────────────────────────────────────────────────────────────────

class _RecommendSection extends StatefulWidget {
  const _RecommendSection({required this.jobs, required this.onTap});
  final List<Map<String, dynamic>> jobs;
  final ValueChanged<Map<String, dynamic>> onTap;

  @override
  State<_RecommendSection> createState() => _RecommendSectionState();
}

class _RecommendSectionState extends State<_RecommendSection> {
  final _scrollCtrl = ScrollController();
  int _index = 0;

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _shift(int direction) {
    final next = (_index + direction).clamp(0, widget.jobs.length - 1);
    if (next == _index) return;
    setState(() => _index = next);
    _scrollCtrl.animateTo(
      next * 180.0,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final canPrev = _index > 0;
    final canNext = _index < widget.jobs.length - 1;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Row(children: [
          Text('맞춤 추천 TOP 5',
              style: TextStyle(color: Color(0xFF1F2A20), fontSize: 15, fontWeight: FontWeight.w900)),
          SizedBox(width: 6),
          Text('내 조건 기준 참고 점수',
              style: TextStyle(color: Color(0xFF6D766A), fontSize: 12)),
        ]),
      ),
      SizedBox(
        height: 150,
        child: Row(children: [
          // 왼쪽 화살표 — 패딩 영역 안에 위치
          SizedBox(
            width: 28,
            child: GestureDetector(
              onTap: canPrev ? () => _shift(-1) : null,
              child: Icon(Icons.chevron_left, size: 26,
                  color: canPrev ? const Color(0xFF86A788) : const Color(0xFFDDDDDD)),
            ),
          ),
          Expanded(
            child: ListView.separated(
              controller: _scrollCtrl,
              scrollDirection: Axis.horizontal,
              itemCount: widget.jobs.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) => _CompactJobCard(
                job: widget.jobs[i],
                onTap: () => widget.onTap(widget.jobs[i]),
              ),
            ),
          ),
          // 오른쪽 화살표 — 패딩 영역 안에 위치
          SizedBox(
            width: 28,
            child: GestureDetector(
              onTap: canNext ? () => _shift(1) : null,
              child: Icon(Icons.chevron_right, size: 26,
                  color: canNext ? const Color(0xFF86A788) : const Color(0xFFDDDDDD)),
            ),
          ),
        ]),
      ),
    ]);
  }
}

class _CompactJobCard extends StatelessWidget {
  const _CompactJobCard({required this.job, required this.onTap});
  final Map<String, dynamic> job;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final score = job['__score'] as int? ?? 0;
    final expired = _isExpired(job);
    // 추천 카드는 항상 주황 테마
    return GestureDetector(
      onTap: expired ? null : onTap,
      child: Container(
        width: 170,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: expired ? const Color(0xFFF5F5F5) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: expired ? const Color(0xFFE5E7EB) : const Color(0xFFE8D9A0),
            width: 1.5,
          ),
          boxShadow: expired ? null : [
            BoxShadow(color: const Color(0xFFF0B429).withValues(alpha: 0.12),
                blurRadius: 8, offset: const Offset(0, 3)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                score > 0 ? '★ $score점' : '★ 추천',
                style: const TextStyle(color: Color(0xFF92400E), fontSize: 11, fontWeight: FontWeight.w800),
              ),
            ),
            if (expired) ...[const SizedBox(width: 4), const _ExpiredBadge()],
          ]),
          const SizedBox(height: 8),
          Text(
            job['recrtTitle']?.toString() ?? '',
            style: TextStyle(
                color: expired ? const Color(0xFF9CA3AF) : const Color(0xFF1F2A20),
                fontSize: 13, fontWeight: FontWeight.w800),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const Spacer(),
          const Divider(height: 12, color: Color(0xFFF0EDD0)),
          Text(
            job['oranNm']?.toString() ?? '',
            style: const TextStyle(color: Color(0xFF6D766A), fontSize: 11),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ]),
      ),
    );
  }
}

// ─── 공고 카드 ────────────────────────────────────────────────────────────────

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.onTap});
  final Map<String, dynamic> job;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final expired = _isExpired(job);
    final empl = _emplMap[job['emplymShp']] ?? job['emplymShpNm']?.toString() ?? '기타';
    final category = _categorize(job);
    final score = job['__score'] as int? ?? 0;

    // 색깔: 마감=회색, 일반=초록
    final barColor = expired ? const Color(0xFFD1D5DB) : const Color(0xFF86A788);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: expired ? const Color(0xFFF9F9F9) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: expired ? const Color(0xFFE9E9E9) : const Color(0xFFDDE9D8),
          ),
          boxShadow: expired ? null : [
            BoxShadow(color: const Color(0xFF86A788).withValues(alpha: 0.06),
                blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Text(
                job['recrtTitle']?.toString() ?? '',
                style: TextStyle(
                  color: expired ? const Color(0xFFAAAAAA) : const Color(0xFF1F2A20),
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  height: 1.35,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (score >= 10) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF86A788).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('$score점',
                    style: const TextStyle(
                        color: Color(0xFF2D5A2E), fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ]),
          const SizedBox(height: 5),
          Text(
            job['oranNm']?.toString() ?? '기업명 미공개',
            style: TextStyle(
              color: expired ? const Color(0xFFCCCCCC) : const Color(0xFF86A788),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 5, runSpacing: 5, children: [
            if (expired) const _ExpiredBadge(),
            _Chip(label: category),
            _Chip(label: empl),
            if (job['workPlcNm'] != null)
              _Chip(label: job['workPlcNm'].toString(), maxWidth: 90),
            if (job['weekHours'] != null)
              _Chip(label: '주 ${job['weekHours']}시간'),
          ]),
          const SizedBox(height: 8),
          Text(
            '${_fmtDate(job['frDd'])} ~ ${_fmtDate(job['toDd'])}',
            style: const TextStyle(color: Color(0xFFBBBBBB), fontSize: 11),
          ),
        ]),
      ),
    );
  }
}

// ─── Job detail bottom sheet ──────────────────────────────────────────────────

class _JobDetailSheet extends StatelessWidget {
  const _JobDetailSheet({
    required this.job,
    required this.profile,
    required this.category,
    required this.onApply,
    required this.onInterest,
  });
  final Map<String, dynamic> job;
  final Map<String, dynamic> profile;
  final String category;
  final VoidCallback onApply;
  final VoidCallback onInterest;

  @override
  Widget build(BuildContext context) {
    final score = job['__score'] ?? _matchScore(job, profile, category);
    final rows = <_Row>[
      _Row('출처', job['source']),
      _Row('추천점수', '$score점'),
      _Row('고용형태',
          _emplMap[job['emplymShp']] ?? job['emplymShpNm']),
      _Row('근무지', job['workPlcNm']),
      _Row('상세주소', job['plDetAddr']),
      _Row('직종', job['jobclsNm']),
      _Row('근무시간', job['workTime']),
      _Row('주당시간',
          job['weekHours'] != null ? '${job['weekHours']}시간' : null),
      _Row('급여', job['wage']),
      _Row('모집인원',
          job['clltPrnnum'] != null ? '${job['clltPrnnum']}명' : null),
      _Row('접수기간', '${_fmtDate(job['frDd'])} ~ ${_fmtDate(job['toDd'])}'),
      _Row('접수방법', job['acptMthd']),
      _Row('연락처', job['clerkContt']),
      _Row('상세내용', job['detCnts']),
    ].where((r) => r.value != null && r.value.toString().isNotEmpty).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    job['recrtTitle']?.toString() ?? '',
                    style: const TextStyle(
                        color: Color(0xFF1F2A20),
                        fontSize: 17,
                        fontWeight: FontWeight.w900),
                  ),
                  Text(
                    job['oranNm']?.toString() ?? '기업명 미공개',
                    style: const TextStyle(color: Color(0xFF6D766A), fontSize: 13),
                  ),
                ]),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ]),
          ),
          const Divider(height: 16),
          Expanded(
            child: ListView(
              controller: ctrl,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                ...rows.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 72,
                              child: Text(r.label,
                                  style: const TextStyle(
                                      color: Color(0xFF6D766A),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700)),
                            ),
                            Expanded(
                              child: Text('${r.value}',
                                  style: const TextStyle(
                                      color: Color(0xFF1F2A20),
                                      fontSize: 13,
                                      height: 1.4)),
                            ),
                          ]),
                    )),
                const SizedBox(height: 80),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onInterest,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF86A788),
                      side: const BorderSide(color: Color(0xFF86A788)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('관심공고 등록',
                        style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: onApply,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF86A788),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('신청하기',
                        style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Row {
  const _Row(this.label, this.value);
  final String label;
  final dynamic value;
}

// ─── 신청 내역 시트 ───────────────────────────────────────────────────────────

class _ApplicationsSheet extends StatelessWidget {
  const _ApplicationsSheet({
    required this.applications,
    required this.onStatusChanged,
  });
  final List<Map<String, dynamic>> applications;
  final Future<void> Function(int id, String status) onStatusChanged;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.95,
      minChildSize: 0.3,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(children: [
              const Expanded(
                child: Text('내가 신청한 일자리',
                    style: TextStyle(
                        color: Color(0xFF1F2A20),
                        fontSize: 17,
                        fontWeight: FontWeight.w900)),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ]),
          ),
          Expanded(
            child: applications.isEmpty
                ? const Center(
                    child: Text('아직 신청한 일자리가 없습니다',
                        style: TextStyle(
                            color: Color(0xFF6D766A), fontSize: 15)))
                : ListView.separated(
                    controller: ctrl,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: applications.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final a = applications[i];
                      final statusColor = _statusColor(a['status']?.toString() ?? '');
                      return ListTile(
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 4),
                        title: Text(
                          a['jobTitle']?.toString() ?? '신청 공고',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 14),
                        ),
                        subtitle: Text(
                            a['company']?.toString() ??
                                a['organization']?.toString() ??
                                '',
                            style: const TextStyle(fontSize: 12)),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            a['status']?.toString() ?? '검토 대기',
                            style: TextStyle(
                                color: statusColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w800),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ]),
      ),
    );
  }

  Color _statusColor(String status) {
    if (status.contains('승인') || status.contains('완료')) {
      return const Color(0xFF86A788);
    }
    if (status.contains('거절') || status.contains('반려')) {
      return const Color(0xFFD94E4E);
    }
    return const Color(0xFFF0B429);
  }
}

// ─── Shared micro-widgets ─────────────────────────────────────────────────────

class _ExpiredBadge extends StatelessWidget {
  const _ExpiredBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF9CA3AF).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text('마감',
          style: TextStyle(
              color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

// ─── 관심공고 시트 ─────────────────────────────────────────────────────────────

class _InterestSheet extends StatelessWidget {
  const _InterestSheet({
    required this.applications,
    required this.onDelete,
    required this.onApply,
  });
  final List<Map<String, dynamic>> applications;
  final Future<void> Function(int id) onDelete;
  final Future<void> Function(int id) onApply;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.95,
      minChildSize: 0.3,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(children: [
              const Expanded(
                child: Text('관심 공고 목록',
                    style: TextStyle(
                        color: Color(0xFF1F2A20),
                        fontSize: 17,
                        fontWeight: FontWeight.w900)),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ]),
          ),
          Expanded(
            child: applications.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('🔖', style: TextStyle(fontSize: 40)),
                        SizedBox(height: 12),
                        Text('등록한 관심공고가 없습니다',
                            style: TextStyle(
                                color: Color(0xFF6D766A),
                                fontSize: 15,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  )
                : ListView.separated(
                    controller: ctrl,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: applications.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final a = applications[i];
                      final id = a['id'];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        title: Text(
                          a['jobTitle']?.toString() ?? '관심 공고',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 14),
                        ),
                        subtitle: Text(
                          a['company']?.toString() ??
                              a['organization']?.toString() ?? '',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TextButton(
                              onPressed: id == null
                                  ? null
                                  : () => onApply(id is int ? id : int.parse('$id')),
                              child: const Text('신청',
                                  style: TextStyle(
                                      color: Color(0xFF86A788),
                                      fontWeight: FontWeight.w800)),
                            ),
                            TextButton(
                              onPressed: id == null
                                  ? null
                                  : () => onDelete(id is int ? id : int.parse('$id')),
                              child: const Text('삭제',
                                  style: TextStyle(
                                      color: Color(0xFFD94E4E),
                                      fontWeight: FontWeight.w800)),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ]),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.maxWidth});
  final String label;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    if (label.isEmpty) return const SizedBox.shrink();
    return Container(
      constraints: maxWidth != null ? BoxConstraints(maxWidth: maxWidth!) : null,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F5E8),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Color(0xFF6D766A), fontSize: 11),
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
