import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    getActiveEnergySupportConsultation,
    getElectricityDiscountDetail,
    getEnergySupportProfile,
    getEnergyVoucherDetail,
    getGasDiscountDetail,
    requestEnergySupportConsultation,
    saveElectricityDiscountDetail,
    saveEnergySupportProfile,
    saveEnergyVoucherDetail,
    saveGasDiscountDetail,
} from '../../api/energySupportApi.js';


const TAB_ITEMS = [
    {
        key: 'profile',
        label: '공통 정보',
    },
    {
        key: 'voucher',
        label: '에너지바우처',
    },
    {
        key: 'electricity',
        label: '전기요금 할인',
    },
    {
        key: 'gas',
        label: '도시가스 경감',
    },
];


const EMPTY_PROFILE = {
    householdSize: '',
    heatingEnergyType: '',

    basicLivelihoodRecipient: null,
    nearPoverty: null,
    disabledHousehold: null,
    nationalMeritHousehold: null,
    seniorHousehold: null,
    infantHousehold: null,
    pregnantHousehold: null,
    singleParentHousehold: null,
    multiChildHousehold: null,
    energyVoucherRecipient: null,
};


const EMPTY_VOUCHER = {
    incomeCriteriaConfirmed: null,
    livelihoodBenefitTypes: '',

    householdCharacteristicConfirmed: null,
    householdCharacteristics: '',

    winterOtherEnergySupportRecipient: null,
    otherEnergySupportTypes: '',

    duplicateSupportDisqualifying: null,

    applicationYear: '',
    applicationResult: '',

    confirmationNote: '',
};


const EMPTY_ELECTRICITY = {
    usesElectricity: null,

    electricityCompany: '',
    electricityProvider: '',

    customerNumber: '',
    contractorName: '',

    addressSame: null,
    serviceAddress: '',

    recentBillChecked: null,
    currentDiscountStatus: '',
    welfareEligible: null,

    note: '',
};


const EMPTY_GAS = {
    usesCityGas: null,

    gasUseType: '',
    gasHeatingType: '',

    gasCompany: '',
    gasCustomerNumber: '',
    gasContractorName: '',

    addressSame: null,
    gasServiceAddress: '',

    recentBillChecked: null,

    severeDisabilityOrMerit: null,
    basicOrNearPoor: null,
    multiChildHousehold: null,
    energyVoucherRecipient: null,

    note: '',
};


function getErrorMessage(
    error,
    fallbackMessage,
) {
    return (
        error
            ?.response
            ?.data
            ?.message
        || error
            ?.response
            ?.data
            ?.error
        || error?.message
        || fallbackMessage
    );
}


function isEmptyValue(value) {
    if (
        value === null
        || value === undefined
    ) {
        return true;
    }

    return (
        typeof value === 'string'
        && value.trim() === ''
    );
}


function countMissingValues(values) {
    return values.filter(
        (value) => isEmptyValue(value),
    ).length;
}


function getProfileMissingCount(profile) {
    return countMissingValues([
        profile.householdSize,
        profile.heatingEnergyType,

        profile.basicLivelihoodRecipient,
        profile.nearPoverty,
        profile.disabledHousehold,
        profile.nationalMeritHousehold,
        profile.seniorHousehold,
        profile.infantHousehold,
        profile.pregnantHousehold,
        profile.singleParentHousehold,
        profile.multiChildHousehold,
        profile.energyVoucherRecipient,
    ]);
}


function getVoucherMissingCount(
    voucher,
    profile,
) {
    let missingCount =
        countMissingValues([
            voucher.incomeCriteriaConfirmed,
            voucher.householdCharacteristicConfirmed,
            voucher.winterOtherEnergySupportRecipient,
            voucher.duplicateSupportDisqualifying,
            voucher.applicationResult,
        ]);

    const benefitTypesRequired =
        voucher.incomeCriteriaConfirmed === true
        || profile.basicLivelihoodRecipient === true;

    if (
        benefitTypesRequired
        && isEmptyValue(
            voucher.livelihoodBenefitTypes,
        )
    ) {
        missingCount += 1;
    }

    if (
        voucher.householdCharacteristicConfirmed
        === true
        && isEmptyValue(
            voucher.householdCharacteristics,
        )
    ) {
        missingCount += 1;
    }

    if (
        voucher.winterOtherEnergySupportRecipient
        === true
        && isEmptyValue(
            voucher.otherEnergySupportTypes,
        )
    ) {
        missingCount += 1;
    }

    const applicationYearRequired = [
        'APPLIED',
        'APPROVED',
        'REJECTED',
    ].includes(
        voucher.applicationResult,
    );

    if (
        applicationYearRequired
        && isEmptyValue(
            voucher.applicationYear,
        )
    ) {
        missingCount += 1;
    }

    return missingCount;
}


function getElectricityMissingCount(
    electricity,
) {
    let missingCount =
        countMissingValues([
            electricity.usesElectricity,
            electricity.welfareEligible,
            electricity.currentDiscountStatus,
        ]);

    if (
        electricity.usesElectricity
        !== true
    ) {
        return missingCount;
    }

    missingCount +=
        countMissingValues([
            electricity.electricityProvider,
            electricity.customerNumber,
            electricity.contractorName,
            electricity.addressSame,
            electricity.recentBillChecked,
        ]);

    if (
        electricity.addressSame === false
        && isEmptyValue(
            electricity.serviceAddress,
        )
    ) {
        missingCount += 1;
    }

    return missingCount;
}


function getGasMissingCount(gas) {
    let missingCount =
        countMissingValues([
            gas.usesCityGas,
            gas.severeDisabilityOrMerit,
            gas.basicOrNearPoor,
            gas.multiChildHousehold,
            gas.energyVoucherRecipient,
        ]);

    if (
        gas.usesCityGas !== true
    ) {
        return missingCount;
    }

    missingCount +=
        countMissingValues([
            gas.gasUseType,
            gas.gasHeatingType,
            gas.gasCompany,
            gas.gasCustomerNumber,
            gas.gasContractorName,
            gas.addressSame,
            gas.recentBillChecked,
        ]);

    if (
        gas.addressSame === false
        && isEmptyValue(
            gas.gasServiceAddress,
        )
    ) {
        missingCount += 1;
    }

    return missingCount;
}


function getTotalMissingCount({
    profile,
    voucher,
    electricity,
    gas,
}) {
    return (
        getProfileMissingCount(
            profile,
        )
        + getVoucherMissingCount(
            voucher,
            profile,
        )
        + getElectricityMissingCount(
            electricity,
        )
        + getGasMissingCount(
            gas,
        )
    );
}


function RequiredMark({
    visible = true,
}) {
    if (!visible) {
        return null;
    }

    return (
        <em
            className="energy-required-mark"
            aria-label="필수 항목"
        >
            *
        </em>
    );
}


function BooleanSelect({
    value,
    onChange,
    disabled = false,
    placeholder = '선택',
}) {
    return (
        <select
            value={
                value === true
                    ? 'true'
                    : value === false
                        ? 'false'
                        : ''
            }
            disabled={disabled}
            onChange={(event) => {
                const nextValue =
                    event.target.value;

                if (nextValue === '') {
                    onChange(null);
                    return;
                }

                onChange(
                    nextValue === 'true',
                );
            }}
        >
            <option value="">
                {placeholder}
            </option>

            <option value="true">
                예
            </option>

            <option value="false">
                아니요
            </option>
        </select>
    );
}


function toInputValue(value) {
    return value === null || value === undefined
        ? ''
        : value;
}


function normalizeProfileData(data) {
    return {
        ...EMPTY_PROFILE,
        ...(data ?? {}),

        householdSize:
            toInputValue(
                data?.householdSize,
            ),

        heatingEnergyType:
            toInputValue(
                data?.heatingEnergyType,
            ),
    };
}


function normalizeVoucherData(data) {
    return {
        ...EMPTY_VOUCHER,
        ...(data ?? {}),

        livelihoodBenefitTypes:
            toInputValue(
                data?.livelihoodBenefitTypes,
            ),

        householdCharacteristics:
            toInputValue(
                data?.householdCharacteristics,
            ),

        otherEnergySupportTypes:
            toInputValue(
                data?.otherEnergySupportTypes,
            ),

        applicationYear:
            toInputValue(
                data?.applicationYear,
            ),

        applicationResult:
            toInputValue(
                data?.applicationResult,
            ),

        confirmationNote:
            toInputValue(
                data?.confirmationNote,
            ),
    };
}


function normalizeElectricityData(data) {
    return {
        ...EMPTY_ELECTRICITY,
        ...(data ?? {}),

        electricityCompany:
            toInputValue(
                data?.electricityCompany,
            ),

        electricityProvider:
            toInputValue(
                data?.electricityProvider
                ?? data?.electricityCompany,
            ),

        customerNumber:
            toInputValue(
                data?.customerNumber,
            ),

        contractorName:
            toInputValue(
                data?.contractorName,
            ),

        serviceAddress:
            toInputValue(
                data?.serviceAddress,
            ),

        currentDiscountStatus:
            toInputValue(
                data?.currentDiscountStatus,
            ),

        note:
            toInputValue(
                data?.note,
            ),
    };
}


function normalizeGasData(data) {
    return {
        ...EMPTY_GAS,
        ...(data ?? {}),

        gasUseType:
            toInputValue(
                data?.gasUseType,
            ),

        gasHeatingType:
            toInputValue(
                data?.gasHeatingType,
            ),

        gasCompany:
            toInputValue(
                data?.gasCompany,
            ),

        gasCustomerNumber:
            toInputValue(
                data?.gasCustomerNumber,
            ),

        gasContractorName:
            toInputValue(
                data?.gasContractorName,
            ),

        gasServiceAddress:
            toInputValue(
                data?.gasServiceAddress,
            ),

        note:
            toInputValue(
                data?.note,
            ),
    };
}


export default function EnergyInformationModal({
    senior,
    onClose,
    onSaved,
}) {
    const [
        activeTab,
        setActiveTab,
    ] = useState('profile');

    const [
        profile,
        setProfile,
    ] = useState({
        ...EMPTY_PROFILE,
    });

    const [
        voucher,
        setVoucher,
    ] = useState({
        ...EMPTY_VOUCHER,
    });

    const [
        electricity,
        setElectricity,
    ] = useState({
        ...EMPTY_ELECTRICITY,
    });

    const [
        gas,
        setGas,
    ] = useState({
        ...EMPTY_GAS,
    });

    const [
        activeConsultation,
        setActiveConsultation,
    ] = useState(null);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        saving,
        setSaving,
    ] = useState(false);

    const [
        consultationRequesting,
        setConsultationRequesting,
    ] = useState(false);

    const [
        errorMessage,
        setErrorMessage,
    ] = useState('');

    const [
        successMessage,
        setSuccessMessage,
    ] = useState('');


    const missingCounts = useMemo(
        () => ({
            profile:
                getProfileMissingCount(
                    profile,
                ),

            voucher:
                getVoucherMissingCount(
                    voucher,
                    profile,
                ),

            electricity:
                getElectricityMissingCount(
                    electricity,
                ),

            gas:
                getGasMissingCount(
                    gas,
                ),
        }),
        [
            profile,
            voucher,
            electricity,
            gas,
        ],
    );


    const totalMissingCount = useMemo(
        () => (
            missingCounts.profile
            + missingCounts.voucher
            + missingCounts.electricity
            + missingCounts.gas
        ),
        [missingCounts],
    );


    const consultationRequested =
        activeConsultation?.status
        === 'REQUESTED'
        || activeConsultation?.status
        === 'IN_PROGRESS';


    const benefitTypesRequired =
        voucher.incomeCriteriaConfirmed === true
        || profile.basicLivelihoodRecipient === true;

    const householdCharacteristicsRequired =
        voucher.householdCharacteristicConfirmed
        === true;

    const otherEnergySupportTypesRequired =
        voucher.winterOtherEnergySupportRecipient
        === true;

    const applicationYearRequired = [
        'APPLIED',
        'APPROVED',
        'REJECTED',
    ].includes(
        voucher.applicationResult,
    );

    const electricityDetailsRequired =
        electricity.usesElectricity === true;

    const electricityAddressRequired =
        electricity.usesElectricity === true
        && electricity.addressSame === false;

    const gasDetailsRequired =
        gas.usesCityGas === true;

    const gasAddressRequired =
        gas.usesCityGas === true
        && gas.addressSame === false;


    useEffect(() => {
        let cancelled = false;

        async function loadEnergyInformation() {
            if (!senior?.id) {
                return;
            }

            setLoading(true);
            setErrorMessage('');
            setSuccessMessage('');

            try {
                const [
                    profileData,
                    voucherData,
                    electricityData,
                    gasData,
                ] = await Promise.all([
                    getEnergySupportProfile(
                        senior.id,
                    ),

                    getEnergyVoucherDetail(
                        senior.id,
                    ),

                    getElectricityDiscountDetail(
                        senior.id,
                    ),

                    getGasDiscountDetail(
                        senior.id,
                    ),
                ]);

                let consultationData = null;

                try {
                    consultationData =
                        await getActiveEnergySupportConsultation(
                            senior.id,
                        );
                } catch (consultationError) {
                    console.error(
                        '에너지복지 상담 요청 상태 조회 실패:',
                        consultationError,
                    );
                }

                if (cancelled) {
                    return;
                }

                setProfile(
                    normalizeProfileData(
                        profileData,
                    ),
                );

                setVoucher(
                    normalizeVoucherData(
                        voucherData,
                    ),
                );

                setElectricity(
                    normalizeElectricityData(
                        electricityData,
                    ),
                );

                setGas(
                    normalizeGasData(
                        gasData,
                    ),
                );

                setActiveConsultation(
                    consultationData ?? null,
                );
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setErrorMessage(
                    getErrorMessage(
                        error,
                        '에너지복지 정보를 불러오지 못했습니다.',
                    ),
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadEnergyInformation();

        return () => {
            cancelled = true;
        };
    }, [senior]);


    function updateProfileField(
        key,
        value,
    ) {
        setProfile(
            (current) => ({
                ...current,
                [key]: value,
            }),
        );

        setSuccessMessage('');
    }


    function updateVoucherField(
        key,
        value,
    ) {
        setVoucher(
            (current) => {
                const nextValue = {
                    ...current,
                    [key]: value,
                };

                if (
                    key
                    === 'incomeCriteriaConfirmed'
                    && value === false
                ) {
                    nextValue.livelihoodBenefitTypes = '';
                }

                if (
                    key
                    === 'householdCharacteristicConfirmed'
                    && value === false
                ) {
                    nextValue.householdCharacteristics = '';
                }

                if (
                    key
                    === 'winterOtherEnergySupportRecipient'
                    && value === false
                ) {
                    nextValue.otherEnergySupportTypes = '';
                }

                if (
                    key === 'applicationResult'
                    && ![
                        'APPLIED',
                        'APPROVED',
                        'REJECTED',
                    ].includes(value)
                ) {
                    nextValue.applicationYear = '';
                }

                return nextValue;
            },
        );

        setSuccessMessage('');
    }


    function updateElectricityField(
        key,
        value,
    ) {
        setElectricity(
            (current) => {
                const nextValue = {
                    ...current,
                    [key]: value,
                };

                if (
                    key === 'usesElectricity'
                    && value !== true
                ) {
                    return {
                        ...nextValue,

                        electricityProvider: '',
                        electricityCompany: '',
                        customerNumber: '',
                        contractorName: '',
                        addressSame: null,
                        serviceAddress: '',
                        recentBillChecked: null,
                    };
                }

                if (
                    key === 'addressSame'
                    && value === true
                ) {
                    nextValue.serviceAddress = '';
                }

                return nextValue;
            },
        );

        setSuccessMessage('');
    }


    function updateGasField(
        key,
        value,
    ) {
        setGas(
            (current) => {
                const nextValue = {
                    ...current,
                    [key]: value,
                };

                if (
                    key === 'usesCityGas'
                    && value !== true
                ) {
                    return {
                        ...nextValue,

                        gasUseType: '',
                        gasHeatingType: '',
                        gasCompany: '',
                        gasCustomerNumber: '',
                        gasContractorName: '',
                        addressSame: null,
                        gasServiceAddress: '',
                        recentBillChecked: null,
                    };
                }

                if (
                    key === 'addressSame'
                    && value === true
                ) {
                    nextValue.gasServiceAddress = '';
                }

                return nextValue;
            },
        );

        setSuccessMessage('');
    }


    function createPayloads() {
        const profilePayload = {
            ...profile,

            householdSize:
                profile.householdSize === ''
                    ? null
                    : Number(
                        profile.householdSize,
                    ),

            heatingEnergyType:
                profile.heatingEnergyType
                || null,
        };


        const voucherPayload = {
            ...voucher,

            livelihoodBenefitTypes:
                benefitTypesRequired
                    ? (
                        voucher.livelihoodBenefitTypes
                        || null
                    )
                    : null,

            householdCharacteristics:
                householdCharacteristicsRequired
                    ? (
                        voucher.householdCharacteristics
                        || null
                    )
                    : null,

            otherEnergySupportTypes:
                otherEnergySupportTypesRequired
                    ? (
                        voucher.otherEnergySupportTypes
                        || null
                    )
                    : null,

            applicationYear:
                applicationYearRequired
                    ? (
                        voucher.applicationYear === ''
                            ? null
                            : Number(
                                voucher.applicationYear,
                            )
                    )
                    : null,

            applicationResult:
                voucher.applicationResult
                || null,

            confirmationNote:
                voucher.confirmationNote
                || null,
        };


        const electricityPayload = {
            ...electricity,

            electricityCompany:
                electricity.electricityProvider
                || null,

            electricityProvider:
                electricity.electricityProvider
                || null,

            customerNumber:
                electricityDetailsRequired
                    ? (
                        electricity.customerNumber
                        || null
                    )
                    : null,

            contractorName:
                electricityDetailsRequired
                    ? (
                        electricity.contractorName
                        || null
                    )
                    : null,

            addressSame:
                electricityDetailsRequired
                    ? electricity.addressSame
                    : null,

            serviceAddress:
                electricityAddressRequired
                    ? (
                        electricity.serviceAddress
                        || null
                    )
                    : null,

            recentBillChecked:
                electricityDetailsRequired
                    ? electricity.recentBillChecked
                    : null,

            currentDiscountStatus:
                electricity.currentDiscountStatus
                || null,

            note:
                electricity.note || null,
        };


        const gasPayload = {
            ...gas,

            gasUseType:
                gasDetailsRequired
                    ? (
                        gas.gasUseType
                        || null
                    )
                    : null,

            gasHeatingType:
                gasDetailsRequired
                    ? (
                        gas.gasHeatingType
                        || null
                    )
                    : null,

            gasCompany:
                gasDetailsRequired
                    ? (
                        gas.gasCompany
                        || null
                    )
                    : null,

            gasCustomerNumber:
                gasDetailsRequired
                    ? (
                        gas.gasCustomerNumber
                        || null
                    )
                    : null,

            gasContractorName:
                gasDetailsRequired
                    ? (
                        gas.gasContractorName
                        || null
                    )
                    : null,

            addressSame:
                gasDetailsRequired
                    ? gas.addressSame
                    : null,

            gasServiceAddress:
                gasAddressRequired
                    ? (
                        gas.gasServiceAddress
                        || null
                    )
                    : null,

            recentBillChecked:
                gasDetailsRequired
                    ? gas.recentBillChecked
                    : null,

            note:
                gas.note || null,
        };


        return {
            profilePayload,
            voucherPayload,
            electricityPayload,
            gasPayload,
        };
    }


    async function saveAllInformation() {
        const {
            profilePayload,
            voucherPayload,
            electricityPayload,
            gasPayload,
        } = createPayloads();

        const [
            savedProfile,
            savedVoucher,
            savedElectricity,
            savedGas,
        ] = await Promise.all([
            saveEnergySupportProfile(
                senior.id,
                profilePayload,
            ),

            saveEnergyVoucherDetail(
                senior.id,
                voucherPayload,
            ),

            saveElectricityDiscountDetail(
                senior.id,
                electricityPayload,
            ),

            saveGasDiscountDetail(
                senior.id,
                gasPayload,
            ),
        ]);

        const nextProfile =
            normalizeProfileData(
                savedProfile
                ?? profilePayload,
            );

        const nextVoucher =
            normalizeVoucherData(
                savedVoucher
                ?? voucherPayload,
            );

        const nextElectricity =
            normalizeElectricityData(
                savedElectricity
                ?? electricityPayload,
            );

        const nextGas =
            normalizeGasData(
                savedGas
                ?? gasPayload,
            );

        const remainingMissingCount =
            getTotalMissingCount({
                profile: nextProfile,
                voucher: nextVoucher,
                electricity:
                    nextElectricity,
                gas: nextGas,
            });

        setProfile(nextProfile);
        setVoucher(nextVoucher);
        setElectricity(
            nextElectricity,
        );
        setGas(nextGas);

        return {
            profile: nextProfile,
            voucher: nextVoucher,
            electricity:
                nextElectricity,
            gas: nextGas,

            remainingMissingCount,

            completed:
                remainingMissingCount === 0,
        };
    }


    async function handleSave() {
        if (
            !senior?.id
            || saving
            || consultationRequesting
        ) {
            return;
        }

        setSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result =
                await saveAllInformation();

            onSaved?.({
                seniorId: senior.id,
                ...result,
                consultationRequested:
                    consultationRequested,
            });

            onClose();
        } catch (error) {
            setErrorMessage(
                getErrorMessage(
                    error,
                    '에너지복지 정보를 저장하지 못했습니다.',
                ),
            );
        } finally {
            setSaving(false);
        }
    }


    async function handleConsultationRequest() {
        if (
            !senior?.id
            || loading
            || saving
            || consultationRequesting
            || consultationRequested
        ) {
            return;
        }

        if (totalMissingCount === 0) {
            setErrorMessage(
                '필수 정보가 모두 입력되어 상담을 요청할 필요가 없습니다.',
            );

            return;
        }

        const confirmed =
            window.confirm(
                `현재 확인하지 못한 필수 정보가 ${totalMissingCount}개 있습니다.\n\n`
                + '현재까지 입력한 정보를 저장하고 담당 복지사에게 확인을 요청하시겠습니까?',
            );

        if (!confirmed) {
            return;
        }

        setConsultationRequesting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const savedResult =
                await saveAllInformation();

            if (
                savedResult.completed
                || savedResult
                    .remainingMissingCount === 0
            ) {
                onSaved?.({
                    seniorId: senior.id,
                    ...savedResult,
                    consultationRequested: false,
                });

                setSuccessMessage(
                    '필수 정보가 모두 입력되어 상담 요청 없이 저장을 완료했습니다.',
                );

                return;
            }

            const consultation =
                await requestEnergySupportConsultation(
                    senior.id,
                    '보호자가 확인하기 어려운 필수 에너지복지 정보에 대해 상담을 요청합니다.',
                );

            setActiveConsultation(
                consultation,
            );

            setSuccessMessage(
                `담당 복지사에게 필수 미입력 ${savedResult.remainingMissingCount}개 항목의 확인을 요청했습니다.`,
            );

            onSaved?.({
                seniorId: senior.id,
                ...savedResult,
                consultationRequested: true,
                consultation,
            });
        } catch (error) {
            setErrorMessage(
                getErrorMessage(
                    error,
                    '상담 요청을 보내지 못했습니다.',
                ),
            );
        } finally {
            setConsultationRequesting(false);
        }
    }


    if (!senior) {
        return null;
    }


    return (
        <div
            className="energy-complement-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (
                    event.target
                    === event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <section
                className="energy-complement-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="energy-complement-title"
            >
                <header className="energy-complement-header">
                    <div>
                        <h2 id="energy-complement-title">
                            {senior.name} 님 에너지 정보 보완
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="energy-complement-close"
                        aria-label="닫기"
                        onClick={onClose}
                        disabled={
                            saving
                            || consultationRequesting
                        }
                    >
                        ×
                    </button>
                </header>

                <nav
                    className="energy-complement-tabs"
                    aria-label="에너지 정보 구분"
                >
                    {TAB_ITEMS.map(
                        (tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={
                                    activeTab === tab.key
                                        ? 'active'
                                        : ''
                                }
                                onClick={() => {
                                    setActiveTab(
                                        tab.key,
                                    );
                                }}
                            >
                                <span>
                                    {tab.label}
                                </span>

                                <strong>
                                    {missingCounts[
                                        tab.key
                                    ]}
                                </strong>
                            </button>
                        ),
                    )}
                </nav>

                {loading ? (
                    <div className="energy-complement-state">
                        에너지복지 정보를 불러오는 중입니다.
                    </div>
                ) : (
                    <div className="energy-complement-body">
                        {errorMessage && (
                            <div className="energy-complement-error">
                                {errorMessage}
                            </div>
                        )}

                        {successMessage && (
                            <div className="energy-complement-success">
                                {successMessage}
                            </div>
                        )}

                        {consultationRequested && (
                            <div className="energy-consultation-status">
                                <div>
                                    <strong>
                                        {activeConsultation?.status
                                            === 'IN_PROGRESS'
                                            ? '담당 복지사가 확인 중입니다.'
                                            : '담당 복지사에게 확인을 요청했습니다.'}
                                    </strong>

                                    <span>
                                        필수 미입력 정보가 확인되면 복지사 화면에서 처리할 수 있습니다.
                                    </span>
                                </div>

                                <span className="energy-consultation-status__badge">
                                    {activeConsultation?.status
                                        === 'IN_PROGRESS'
                                        ? '확인 중'
                                        : '요청 완료'}
                                </span>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="energy-complement-section">
                                <div className="energy-complement-grid">
                                    <label>
                                        <span>
                                            주민등록상 세대원 수
                                            <RequiredMark />
                                        </span>

                                        <input
                                            type="number"
                                            min="1"
                                            value={
                                                profile.householdSize ?? ''
                                            }
                                            placeholder="예: 1"
                                            onChange={(event) => {
                                                updateProfileField(
                                                    'householdSize',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            주 난방 에너지원
                                            <RequiredMark />
                                        </span>

                                        <select
                                            value={
                                                profile
                                                    .heatingEnergyType
                                            }
                                            onChange={(event) => {
                                                updateProfileField(
                                                    'heatingEnergyType',
                                                    event.target.value,
                                                );
                                            }}
                                        >
                                            <option value="">
                                                선택
                                            </option>

                                            <option value="CITY_GAS">
                                                도시가스
                                            </option>

                                            <option value="LPG">
                                                LPG
                                            </option>

                                            <option value="KEROSENE">
                                                등유
                                            </option>

                                            <option value="ELECTRICITY">
                                                전기
                                            </option>

                                            <option value="BRIQUETTE">
                                                연탄
                                            </option>

                                            <option value="DISTRICT_HEATING">
                                                지역난방
                                            </option>

                                            <option value="OTHER">
                                                기타
                                            </option>
                                        </select>
                                    </label>

                                    {[
                                        [
                                            'basicLivelihoodRecipient',
                                            '기초생활수급 세대',
                                        ],
                                        [
                                            'nearPoverty',
                                            '차상위계층 세대',
                                        ],
                                        [
                                            'disabledHousehold',
                                            '장애인 포함 세대',
                                        ],
                                        [
                                            'nationalMeritHousehold',
                                            '국가유공자 포함 세대',
                                        ],
                                        [
                                            'seniorHousehold',
                                            '노인 포함 세대',
                                        ],
                                        [
                                            'infantHousehold',
                                            '영유아 포함 세대',
                                        ],
                                        [
                                            'pregnantHousehold',
                                            '임신·출산 해당 세대',
                                        ],
                                        [
                                            'singleParentHousehold',
                                            '한부모 세대',
                                        ],
                                        [
                                            'multiChildHousehold',
                                            '다자녀 세대',
                                        ],
                                        [
                                            'energyVoucherRecipient',
                                            '에너지바우처 수급 중',
                                        ],
                                    ].map(
                                        ([
                                            key,
                                            label,
                                        ]) => (
                                            <label key={key}>
                                                <span>
                                                    {label}
                                                    <RequiredMark />
                                                </span>

                                                <BooleanSelect
                                                    value={
                                                        profile[key]
                                                    }
                                                    onChange={(value) => {
                                                        updateProfileField(
                                                            key,
                                                            value,
                                                        );
                                                    }}
                                                />
                                            </label>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'voucher' && (
                            <div className="energy-complement-section">
                                <div className="energy-complement-grid">
                                    <label>
                                        <span>
                                            소득 기준 확인
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                voucher
                                                    .incomeCriteriaConfirmed
                                            }
                                            onChange={(value) => {
                                                updateVoucherField(
                                                    'incomeCriteriaConfirmed',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            수급 급여 종류

                                            <RequiredMark
                                                visible={
                                                    benefitTypesRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                voucher.livelihoodBenefitTypes
                                                ?? ''
                                            }
                                            disabled={
                                                !benefitTypesRequired
                                            }
                                            placeholder="예: 생계급여, 의료급여"
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'livelihoodBenefitTypes',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            세대 특성 확인
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                voucher
                                                    .householdCharacteristicConfirmed
                                            }
                                            onChange={(value) => {
                                                updateVoucherField(
                                                    'householdCharacteristicConfirmed',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            세대 특성

                                            <RequiredMark
                                                visible={
                                                    householdCharacteristicsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                voucher
                                                    .householdCharacteristics
                                            }
                                            disabled={
                                                !householdCharacteristicsRequired
                                            }
                                            placeholder="예: 노인 세대, 장애인 세대"
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'householdCharacteristics',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            동절기 타 에너지 지원 수급
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                voucher
                                                    .winterOtherEnergySupportRecipient
                                            }
                                            onChange={(value) => {
                                                updateVoucherField(
                                                    'winterOtherEnergySupportRecipient',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            다른 에너지 지원 종류

                                            <RequiredMark
                                                visible={
                                                    otherEnergySupportTypesRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                voucher
                                                    .otherEnergySupportTypes
                                            }
                                            disabled={
                                                !otherEnergySupportTypesRequired
                                            }
                                            placeholder="예: 연탄쿠폰"
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'otherEnergySupportTypes',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            중복지원으로 신청 불가
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                voucher
                                                    .duplicateSupportDisqualifying
                                            }
                                            onChange={(value) => {
                                                updateVoucherField(
                                                    'duplicateSupportDisqualifying',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            신청 연도

                                            <RequiredMark
                                                visible={
                                                    applicationYearRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="number"
                                            min="2020"
                                            max="2100"
                                            value={
                                                voucher.applicationYear
                                            }
                                            disabled={
                                                !applicationYearRequired
                                            }
                                            placeholder="예: 2026"
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'applicationYear',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            현재 신청 결과
                                            <RequiredMark />
                                        </span>

                                        <select
                                            value={
                                                voucher.applicationResult
                                            }
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'applicationResult',
                                                    event.target.value,
                                                );
                                            }}
                                        >
                                            <option value="">
                                                선택
                                            </option>

                                            <option value="UNKNOWN">
                                                확인 필요
                                            </option>

                                            <option value="NOT_APPLIED">
                                                미신청
                                            </option>

                                            <option value="APPLIED">
                                                신청 완료
                                            </option>

                                            <option value="APPROVED">
                                                승인
                                            </option>

                                            <option value="REJECTED">
                                                미승인
                                            </option>
                                        </select>
                                    </label>

                                    <label className="energy-complement-full">
                                        <span>
                                            확인 메모
                                        </span>

                                        <textarea
                                            value={
                                                voucher.confirmationNote
                                            }
                                            placeholder="확인한 내용을 입력해 주세요."
                                            onChange={(event) => {
                                                updateVoucherField(
                                                    'confirmationNote',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'electricity' && (
                            <div className="energy-complement-section">
                                <div className="energy-complement-grid">
                                    <label>
                                        <span>
                                            전기 사용 여부
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                electricity
                                                    .usesElectricity
                                            }
                                            onChange={(value) => {
                                                updateElectricityField(
                                                    'usesElectricity',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            전기 공급사

                                            <RequiredMark
                                                visible={
                                                    electricityDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                electricity
                                                    .electricityProvider
                                            }
                                            disabled={
                                                !electricityDetailsRequired
                                            }
                                            placeholder="예: 한국전력공사"
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'electricityProvider',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            고객번호

                                            <RequiredMark
                                                visible={
                                                    electricityDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                electricity.customerNumber
                                            }
                                            disabled={
                                                !electricityDetailsRequired
                                            }
                                            placeholder="고지서의 고객번호"
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'customerNumber',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            계약자 명의

                                            <RequiredMark
                                                visible={
                                                    electricityDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                electricity.contractorName
                                            }
                                            disabled={
                                                !electricityDetailsRequired
                                            }
                                            placeholder="계약자 이름"
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'contractorName',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            주민등록 주소와 사용 주소 일치

                                            <RequiredMark
                                                visible={
                                                    electricityDetailsRequired
                                                }
                                            />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                electricity.addressSame
                                            }
                                            disabled={
                                                !electricityDetailsRequired
                                            }
                                            onChange={(value) => {
                                                updateElectricityField(
                                                    'addressSame',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            전기 사용 주소

                                            <RequiredMark
                                                visible={
                                                    electricityAddressRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                electricity.serviceAddress
                                            }
                                            disabled={
                                                !electricityAddressRequired
                                            }
                                            placeholder="실제 전기 사용 주소"
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'serviceAddress',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            최근 고지서 확인

                                            <RequiredMark
                                                visible={
                                                    electricityDetailsRequired
                                                }
                                            />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                electricity
                                                    .recentBillChecked
                                            }
                                            disabled={
                                                !electricityDetailsRequired
                                            }
                                            onChange={(value) => {
                                                updateElectricityField(
                                                    'recentBillChecked',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            현재 할인 적용 상태
                                            <RequiredMark />
                                        </span>

                                        <select
                                            value={
                                                electricity
                                                    .currentDiscountStatus
                                            }
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'currentDiscountStatus',
                                                    event.target.value,
                                                );
                                            }}
                                        >
                                            <option value="">
                                                선택
                                            </option>

                                            <option value="UNKNOWN">
                                                확인 필요
                                            </option>

                                            <option value="NOT_APPLIED">
                                                미적용
                                            </option>

                                            <option value="APPLIED">
                                                적용 중
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>
                                            복지 할인 자격
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                electricity
                                                    .welfareEligible
                                            }
                                            onChange={(value) => {
                                                updateElectricityField(
                                                    'welfareEligible',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label className="energy-complement-full">
                                        <span>
                                            확인 메모
                                        </span>

                                        <textarea
                                            value={
                                                electricity.note
                                            }
                                            placeholder="확인한 내용을 입력해 주세요."
                                            onChange={(event) => {
                                                updateElectricityField(
                                                    'note',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'gas' && (
                            <div className="energy-complement-section">
                                <div className="energy-complement-grid">
                                    <label>
                                        <span>
                                            도시가스 사용 여부
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={gas.usesCityGas}
                                            onChange={(value) => {
                                                updateGasField(
                                                    'usesCityGas',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            가스 사용 형태

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <select
                                            value={gas.gasUseType}
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasUseType',
                                                    event.target.value,
                                                );
                                            }}
                                        >
                                            <option value="">
                                                선택
                                            </option>

                                            <option value="INDIVIDUAL">
                                                개별 사용
                                            </option>

                                            <option value="APARTMENT">
                                                공동주택
                                            </option>

                                            <option value="CENTRAL">
                                                중앙 공급
                                            </option>

                                            <option value="OTHER">
                                                기타
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>
                                            가스 난방 방식

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <select
                                            value={
                                                gas.gasHeatingType
                                            }
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasHeatingType',
                                                    event.target.value,
                                                );
                                            }}
                                        >
                                            <option value="">
                                                선택
                                            </option>

                                            <option value="INDIVIDUAL_HEATING">
                                                개별난방
                                            </option>

                                            <option value="CENTRAL_HEATING">
                                                중앙난방
                                            </option>

                                            <option value="DISTRICT_HEATING">
                                                지역난방
                                            </option>

                                            <option value="NONE">
                                                난방에 사용하지 않음
                                            </option>

                                            <option value="OTHER">
                                                기타
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>
                                            도시가스 공급회사

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                gas.gasCompany
                                                ?? ''
                                            }
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            placeholder="도시가스 회사명"
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasCompany',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            고객번호

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                gas.gasCustomerNumber
                                            }
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            placeholder="고지서의 고객번호"
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasCustomerNumber',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            계약자 명의

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                gas.gasContractorName
                                            }
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            placeholder="계약자 이름"
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasContractorName',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            주민등록 주소와 사용 주소 일치

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <BooleanSelect
                                            value={gas.addressSame}
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'addressSame',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            도시가스 사용 주소

                                            <RequiredMark
                                                visible={
                                                    gasAddressRequired
                                                }
                                            />
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                gas.gasServiceAddress
                                            }
                                            disabled={
                                                !gasAddressRequired
                                            }
                                            placeholder="실제 도시가스 사용 주소"
                                            onChange={(event) => {
                                                updateGasField(
                                                    'gasServiceAddress',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            최근 고지서 확인

                                            <RequiredMark
                                                visible={
                                                    gasDetailsRequired
                                                }
                                            />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                gas.recentBillChecked
                                            }
                                            disabled={
                                                !gasDetailsRequired
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'recentBillChecked',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            중증장애·유공자 자격
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                gas
                                                    .severeDisabilityOrMerit
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'severeDisabilityOrMerit',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            기초수급·차상위 자격
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                gas.basicOrNearPoor
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'basicOrNearPoor',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            다자녀 세대
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                gas.multiChildHousehold
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'multiChildHousehold',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            에너지바우처 수급 중
                                            <RequiredMark />
                                        </span>

                                        <BooleanSelect
                                            value={
                                                gas
                                                    .energyVoucherRecipient
                                            }
                                            onChange={(value) => {
                                                updateGasField(
                                                    'energyVoucherRecipient',
                                                    value,
                                                );
                                            }}
                                        />
                                    </label>

                                    <label className="energy-complement-full">
                                        <span>
                                            확인 메모
                                        </span>

                                        <textarea
                                            value={gas.note}
                                            placeholder="확인한 내용을 입력해 주세요."
                                            onChange={(event) => {
                                                updateGasField(
                                                    'note',
                                                    event.target.value,
                                                );
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <footer className="energy-complement-footer">
                    <div className="energy-complement-footer__status">
                        <strong>
                            필수 미입력 {totalMissingCount}개
                        </strong>

                        <span>
                            {consultationRequested
                                ? '담당 복지사에게 확인을 요청한 상태입니다.'
                                : '모르는 필수 항목은 담당 복지사에게 확인을 요청할 수 있습니다.'}
                        </span>
                    </div>

                    <div className="energy-complement-footer__actions">
                        <button
                            type="button"
                            className="energy-complement-cancel"
                            onClick={onClose}
                            disabled={
                                saving
                                || consultationRequesting
                            }
                        >
                            취소
                        </button>

                        <button
                            type="button"
                            className="energy-complement-save"
                            onClick={handleSave}
                            disabled={
                                loading
                                || saving
                                || consultationRequesting
                            }
                        >
                            {saving
                                ? '저장 중...'
                                : '정보 저장'}
                        </button>

                        <button
                            type="button"
                            className={[
                                'energy-consultation-button',

                                consultationRequested
                                    ? 'energy-consultation-button--requested'
                                    : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            onClick={
                                handleConsultationRequest
                            }
                            disabled={
                                loading
                                || saving
                                || consultationRequesting
                                || consultationRequested
                                || totalMissingCount === 0
                            }
                        >
                            {consultationRequesting
                                ? '요청 중...'
                                : consultationRequested
                                    ? '확인 요청 완료'
                                    : '상담 요청'}
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
}