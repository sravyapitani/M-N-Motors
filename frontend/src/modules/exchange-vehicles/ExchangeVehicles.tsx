
import { useEffect, useMemo, useState } from 'react';
import './ExchangeVehicles.css';

type VehicleStage =
    | 'Intake'
    | 'Inspection'
    | 'Valuation'
    | 'Approval'
    | 'Purchased'
    | 'Refurbishment'
    | 'Listed for Resale'
    | 'Resold'
    | 'Cancelled';

type RcStatus =
    | 'Not Scanned'
    | 'Genuine'
    | 'Needs Verification'
    | 'High Risk';

type BackendVehicle = {
    id: string;
    customerName: string;
    vehicleName: string;
    make: string | null;
    model: string | null;
    variant: string | null;
    modelYear: number | null;
    odometerKm: number;
    score: number | null;
    aiValuation: number | null;
    rcBookStatus: string;
    stage: string;
    branchId: string;
    registrationNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    colour?: string | null;
};

type IntakeBranch = {
    id: string;
    code: string;
    name: string;
};

type VehicleRecord = {
    id: string;
    customer: string;
    vehicle: string;
    branch: string;
    branchId: string;
    registrationNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    colour: string | null;
    year: number | null;
    odometer: string;
    score: number | null;
    aiValuation: number | null;
    finalValuation: number | null;
    listedPrice: number | null;
    rcBook: RcStatus;
    stage: VehicleStage;
};

type VehicleInspection = {
    id: string;
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'VERY_POOR';
    notes: string | null;
    inspectionScore: number;
    accidentHistory: boolean | null;
    accidentSeverity: 'MINOR' | 'MODERATE' | 'MAJOR' | null;
    repaintHistory: boolean | null;
    repaintCoverage: 'ONE_TO_TWO_PANELS' | 'THREE_TO_FIVE_PANELS' | 'FULL_BODY' | null;
    fullServiceHistory: boolean | null;
    createdAt: string;
};

type VehicleDocument = {
    id: string;
    vehicleId: string;
    documentType: 'RC_BOOK_FRONT' | 'RC_BOOK_BACK';
    originalName: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
};

type RcExtractedFields = {
    registrationNumber: string | null;
    ownerName: string | null;
    vehicleClass: string | null;
    vehicleModel: string | null;
    registrationDate: string | null;
    rtoCode: string | null;
    chassisNumber: string | null;
    engineNumber: string | null;
    vehicleColour: string | null;
    hypothecationDetails: string | null;
    financierName: string | null;
};

type ExtractionSummary = {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    lowConfidenceDocuments?: {
        documentType: string;
        confidence: number;
        status: string;
        message: string;
    }[];
    confidenceUnavailableDocuments?: {
        documentType: string;
        status: string;
        message: string;
    }[];
};

type RcVerificationResult = {
    verificationId: string;
    vehicleId: string;
    documentCount: number;
    comparison: {
        field: string;
        rcBookValue: string | null;
        vehicleRecordValue: string | null;
        result: 'MATCH' | 'MISMATCH' | 'NOT_AVAILABLE';
    }[];
    checkResults: {
        ruleKey: string;
        ruleName: string;
        passed: boolean;
        result: string;
        weightApplied: number;
    }[];
    flags: {
        ruleKey: string;
        ruleName: string;
        category: string;
        weight: number;
        message: string;
    }[];
    extractedFields?: RcExtractedFields;
    riskScore: number;
    riskVerdict: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
    assessmentStatus?: string;
    authenticityStatus?: string;
    reviewStatus: string;
    reviewerName?: string | null;
    reviewRemarks?: string | null;
    reviewedAt?: string | null;
    verificationRequired: boolean;
    note: string;
};


const pipelineStages: VehicleStage[] = [
    'Intake',
    'Inspection',
    'Valuation',
    'Approval',
    'Purchased',
    'Refurbishment',
    'Listed for Resale',
    'Resold',
    'Cancelled',
];

function formatMoney(amount: number | null): string {
    if (amount === null || amount === undefined) {
        return '—';
    }

    return `₹${amount.toLocaleString('en-IN')}`;
}

function getStageClass(stage: VehicleStage): string {
    return `stage-${stage.toLowerCase().replaceAll(' ', '-')}`;
}
function mapVehicleStage(stage: string): VehicleStage {
    const stageMap: Record<string, VehicleStage> = {
        INTAKE: 'Intake',
        INSPECTION: 'Inspection',
        VALUATION: 'Valuation',
        APPROVAL: 'Approval',
        PURCHASED: 'Purchased',
        REFURBISHMENT: 'Refurbishment',
        LISTED: 'Listed for Resale',
        RESOLD: 'Resold',
        CANCELLED: 'Cancelled',
    };

    const mappedStage = stageMap[stage];

    if (!mappedStage) {
        throw new Error(`Unknown vehicle stage: ${stage}`);
    }

    return mappedStage;
}

function mapRcStatus(status: string): RcStatus {
    const statusMap: Record<string, RcStatus> = {
        NOT_SCANNED: 'Not Scanned',
        GENUINE: 'Genuine',
        NEEDS_VERIFICATION: 'Needs Verification',
        HIGH_RISK: 'High Risk',
    };

    const mappedStatus = statusMap[status];

    if (!mappedStatus) {
        throw new Error(`Unknown RC Book status: ${status}`);
    }

    return mappedStatus;
}

function mapBackendVehicle(vehicle: BackendVehicle): VehicleRecord {
    return {
        id: vehicle.id,
        customer: vehicle.customerName,
        vehicle: vehicle.vehicleName,
        branch: `Branch ID: ${vehicle.branchId}`,
        branchId: vehicle.branchId,
        registrationNumber: vehicle.registrationNumber ?? null,
        chassisNumber: vehicle.chassisNumber ?? null,
        engineNumber: vehicle.engineNumber ?? null,
        colour: vehicle.colour ?? null,
        year: vehicle.modelYear,
        odometer: `${vehicle.odometerKm.toLocaleString('en-IN')} km`,
        score: vehicle.score,
        aiValuation: vehicle.aiValuation,
        finalValuation: null,
        listedPrice: null,
        rcBook: mapRcStatus(vehicle.rcBookStatus),
        stage: mapVehicleStage(vehicle.stage),
    };
}

function ExchangeVehicles() {
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedVehicle, setSelectedVehicle] =
        useState<VehicleRecord | null>(null);
    const [showVehicleEdit, setShowVehicleEdit] = useState(false);
    const [editVehicleForm, setEditVehicleForm] = useState({
        registrationNumber: '',
        chassisNumber: '',
        engineNumber: '',
        year: '',
        odometer: '',
    });
    const [records, setRecords] = useState<VehicleRecord[]>([]);
    const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);

    const [vehicleDocuments, setVehicleDocuments] = useState<VehicleDocument[]>([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);

    const [inspection, setInspection] = useState<VehicleInspection | null>(null);
    const [loadingInspection, setLoadingInspection] = useState(false);
    const [savingInspection, setSavingInspection] = useState(false);
    const [inspectionMessage, setInspectionMessage] = useState('');
    const [showInspectionForm, setShowInspectionForm] = useState(false);

    const [accidentHistorySelection, setAccidentHistorySelection] = useState('');
    const [repaintHistorySelection, setRepaintHistorySelection] = useState('');
    const [accidentSeveritySelection, setAccidentSeveritySelection] = useState('');
    const [repaintCoverageSelection, setRepaintCoverageSelection] = useState('');

    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [apiError, setApiError] = useState('');

    const [calculatingValuation, setCalculatingValuation] = useState(false);
    const [valuationResult, setValuationResult] = useState<any>(null);
    const [valuationMessage, setValuationMessage] = useState('');
    const [evaluatorQuotedValue, setEvaluatorQuotedValue] = useState('');
    const [evaluatorRemarks, setEvaluatorRemarks] = useState('');

    const [managerFinalValue, setManagerFinalValue] = useState('');
    const [managerReviewerName, setManagerReviewerName] = useState('');
    const [managerRemarks, setManagerRemarks] = useState('');
    const [submittingValuationReview, setSubmittingValuationReview] = useState(false);
    const [valuationReviewMessage, setValuationReviewMessage] = useState('');

    useEffect(() => {
        async function fetchVehicles() {
            try {
                setLoadingVehicles(true);
                setApiError('');

                const response = await fetch(
                    'http://localhost:3000/api/exchange-vehicles'
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch vehicles: ${response.status}`);
                }

                const result = await response.json();

                const backendVehicles: BackendVehicle[] = result.data;

                setRecords(backendVehicles.map(mapBackendVehicle));
            } catch (error) {
                console.error('Error fetching vehicles:', error);

                setApiError(
                    error instanceof Error
                        ? error.message
                        : 'Something went wrong while loading vehicles.'
                );
            } finally {
                setLoadingVehicles(false);
            }
        }

        fetchVehicles();
    }, []);
    const [showIntakeForm, setShowIntakeForm] = useState(false);

    const [activeBranches, setActiveBranches] = useState<IntakeBranch[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [intakeError, setIntakeError] = useState('');
    const [intakeSuccess, setIntakeSuccess] = useState('');
    const [submittingIntake, setSubmittingIntake] = useState(false);

    const [scanMessage, setScanMessage] = useState('');
    const [scanResults, setScanResults] = useState<{
        front: string;
        back: string;
    } | null>(null);
    const [comparisonResults, setComparisonResults] = useState<{
        registrationNumber: {
            rcValue: string | null;
            vehicleValue: string | null;
            status: 'MATCH' | 'MISMATCH' | 'POSSIBLE_OCR_ERROR' | 'NOT_AVAILABLE';
        };
        chassisNumber: {
            rcValue: string | null;
            vehicleValue: string | null;
            status: 'MATCH' | 'MISMATCH' | 'POSSIBLE_OCR_ERROR' | 'NOT_AVAILABLE';
        };
        engineNumber: {
            rcValue: string | null;
            vehicleValue: string | null;
            status: 'MATCH' | 'MISMATCH' | 'POSSIBLE_OCR_ERROR' | 'NOT_AVAILABLE';
        };
        vehicleColour: {
            rcValue: string | null;
            vehicleValue: string | null;
            status: 'MATCH' | 'MISMATCH' | 'POSSIBLE_OCR_ERROR' | 'NOT_AVAILABLE';
        };
    } | null>(null);

    const [extractedFields, setExtractedFields] =
        useState<RcExtractedFields | null>(null);

    const [extractionSummary, setExtractionSummary] =
        useState<ExtractionSummary | null>(null);

    const [verificationResult, setVerificationResult] =
        useState<RcVerificationResult | null>(null);

    const [reviewerName, setReviewerName] = useState('');
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [reviewStatus, setReviewStatus] = useState<
        '' | 'APPROVED' | 'REJECTED' | 'NEEDS_RESUBMISSION'
    >('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [reviewMessage, setReviewMessage] = useState('');

    const [rcBookFile, setRcBookFile] = useState<File | null>(null);
    const [rcFrontFile, setRcFrontFile] = useState<File | null>(null);
    const [rcBackFile, setRcBackFile] = useState<File | null>(null);
    const [uploadingRcBook, setUploadingRcBook] = useState(false);
    const [rcUploadMessage, setRcUploadMessage] = useState('');

    const rowsPerPage = 8;

    const filteredVehicles = useMemo(() => {
        const query = search.trim().toLowerCase();

        return records.filter((record) => {
            const matchesSearch =
                !query ||
                [
                    record.customer,
                    record.vehicle,
                    record.branch,
                    record.odometer,
                    record.stage,
                    record.rcBook,
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(query);

            const matchesStage =
                stageFilter === 'All' || record.stage === stageFilter;

            return matchesSearch && matchesStage;
        });
    }, [records, search, stageFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredVehicles.length / rowsPerPage),
    );

    const visibleVehicles = filteredVehicles.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage,
    );

    const stageCount = (stage: VehicleStage) =>
        records.filter((record) => record.stage === stage).length;

    const inPipeline = records.filter(
        (record) => record.stage !== 'Resold',
    ).length;

    const resoldCount = stageCount('Resold');

    const valuedRecords = records.filter(
        (record) => record.aiValuation !== null
    );

    const averageValuation =
        valuedRecords.length > 0
            ? valuedRecords.reduce(
                (sum, record) => sum + (record.aiValuation ?? 0),
                0
            ) / valuedRecords.length
            : null;

    const highRiskCount = records.filter(
        (record) => record.rcBook === 'High Risk',
    ).length;

    const scannedCount = records.filter(
        (record) => record.rcBook !== 'Not Scanned',
    ).length;

    const genuineCount = records.filter(
        (record) => record.rcBook === 'Genuine',
    ).length;

    const verificationCount = records.filter(
        (record) => record.rcBook === 'Needs Verification',
    ).length;

    const openIntakeForm = async () => {
        setShowIntakeForm(true);
        setIntakeError('');
        setIntakeSuccess('');
        setLoadingBranches(true);

        try {
            const response = await fetch(
                'http://localhost:3000/api/exchange-vehicles/branches/active'
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to load branches.');
            }

            const branches: IntakeBranch[] = result.data || [];
            setActiveBranches(branches);

            if (branches.length === 0) {
                setIntakeError('No active branches available. Please contact the administrator.');
            }
        } catch (error) {
            setIntakeError(
                error instanceof Error ? error.message : 'Unable to load branches.'
            );
        } finally {
            setLoadingBranches(false);
        }
    };

    const handleIntakeSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        const make = String(formData.get('make') || '').trim();
        const model = String(formData.get('model') || '').trim();
        const variant = String(formData.get('variant') || '').trim();
        const registrationDate = String(formData.get('registrationDate') || '');

        const payload = {
            customerName: String(formData.get('customerName') || '').trim(),

            // Generate vehicle name automatically.
            vehicleName: [make, model, variant].filter(Boolean).join(' '),

            make,
            model,
            variant: variant || undefined,

            modelYear: Number(formData.get('modelYear')),
            fuelType: String(formData.get('fuelType') || ''),
            vehicleSegment: String(formData.get('vehicleSegment') || ''),
            odometerKm: Number(formData.get('odometerKm')),

            previousOwnerCount:
                formData.get('previousOwnerCount') !== ''
                    ? Number(formData.get('previousOwnerCount'))
                    : undefined,

            branchId: String(formData.get('branchId') || ''),

            registrationNumber:
                String(formData.get('registrationNumber') || '').trim() || undefined,

            chassisNumber:
                String(formData.get('chassisNumber') || '').trim().toUpperCase() || undefined,

            engineNumber:
                String(formData.get('engineNumber') || '').trim().toUpperCase() || undefined,
            colour: String(formData.get('colour') || '').trim(),

            registrationDate: registrationDate
                ? new Date(`${registrationDate}T00:00:00`).toISOString()
                : undefined,
        };

        try {
            setSubmittingIntake(true);
            setIntakeError('');
            setIntakeSuccess('');

            const response = await fetch(
                'http://localhost:3000/api/exchange-vehicles',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(result.message)
                        ? result.message.join(', ')
                        : result.message || 'Failed to create vehicle intake.'
                );
            }

            // Fetch the latest records from the backend.
            const vehiclesResponse = await fetch(
                'http://localhost:3000/api/exchange-vehicles'
            );

            const vehiclesResult = await vehiclesResponse.json();

            if (!vehiclesResponse.ok) {
                throw new Error('Intake created, but vehicle table refresh failed.');
            }

            const backendVehicles: BackendVehicle[] = vehiclesResult.data || [];

            setRecords(backendVehicles.map(mapBackendVehicle));

            // Show the new record at the top of the table.
            setSearch('');
            setStageFilter('All');
            setCurrentPage(1);

            setShowIntakeForm(false);
            setIntakeSuccess('New exchange intake created successfully.');
        } catch (error) {
            setIntakeError(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while creating intake.'
            );
        } finally {
            setSubmittingIntake(false);
        }
    };

    const fetchVehicleInspection = async (vehicleId: string) => {
        setLoadingInspection(true);
        setInspection(null);
        setInspectionMessage('');

        try {
            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${vehicleId}/inspection`
            );

            if (!response.ok) {
                throw new Error('Failed to load vehicle inspection');
            }

            const result = await response.json();

            const inspections: VehicleInspection[] = Array.isArray(result.data)
                ? result.data
                : Array.isArray(result.data?.inspections)
                    ? result.data.inspections
                    : [];

            setInspection(inspections[0] ?? null);
        } catch (error) {
            setInspectionMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to load inspection details'
            );
        } finally {
            setLoadingInspection(false);
        }
    };

    const handleInspectionSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!selectedVehicle) return;

        const formData = new FormData(event.currentTarget);

        const payload = {
            condition: String(formData.get('condition') || ''),
            inspectionScore: Number(formData.get('inspectionScore')),
            accidentHistory:
                formData.get('accidentHistory') === 'true'
                    ? true
                    : formData.get('accidentHistory') === 'false'
                        ? false
                        : null,
            accidentSeverity: String(formData.get('accidentSeverity') || '') || null,
            repaintHistory:
                formData.get('repaintHistory') === 'true'
                    ? true
                    : formData.get('repaintHistory') === 'false'
                        ? false
                        : null,
            repaintCoverage: String(formData.get('repaintCoverage') || '') || null,
            fullServiceHistory:
                formData.get('fullServiceHistory') === 'true'
                    ? true
                    : formData.get('fullServiceHistory') === 'false'
                        ? false
                        : null,
            notes: String(formData.get('notes') || '').trim(),
        };

        try {
            setSavingInspection(true);
            setInspectionMessage('');

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/inspection/validate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || 'Failed to save vehicle inspection.'
                );
            }

            // Move the vehicle to the Inspection stage after saving.
            const stageResponse = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/stage`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ stage: 'INSPECTION' }),
                }
            );

            if (!stageResponse.ok) {
                throw new Error(
                    'Inspection saved, but vehicle stage could not be updated.'
                );
            }

            await fetchVehicleInspection(selectedVehicle.id);

            // Refresh the vehicle table from the backend.
            const vehiclesResponse = await fetch(
                'http://localhost:3000/api/exchange-vehicles'
            );

            if (vehiclesResponse.ok) {
                const vehiclesResult = await vehiclesResponse.json();
                const updatedRecords: VehicleRecord[] =
                    (vehiclesResult.data || []).map(mapBackendVehicle);

                setRecords(updatedRecords);

                const updatedVehicle = updatedRecords.find(
                    (vehicle) => vehicle.id === selectedVehicle.id
                );

                if (updatedVehicle) {
                    setSelectedVehicle(updatedVehicle);
                }
            }

            setShowInspectionForm(false);
            setInspectionMessage('Vehicle inspection saved successfully.');
        } catch (error) {
            setInspectionMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to save vehicle inspection.'
            );
        } finally {
            setSavingInspection(false);
        }
    };

    const handleCalculateValuation = async () => {
        if (!selectedVehicle) return;

        try {
            setCalculatingValuation(true);
            setValuationMessage('');
            setValuationResult(null);

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/valuation/calculate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...(evaluatorQuotedValue.trim() !== ''
                            ? { evaluatorQuotedValue: Number(evaluatorQuotedValue) }
                            : {}),
                        ...(evaluatorRemarks.trim() !== ''
                            ? { evaluatorRemarks: evaluatorRemarks.trim() }
                            : {}),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(result.message)
                        ? result.message.join(', ')
                        : result.message || 'Valuation calculation failed.'
                );
            }

            setValuationResult(result.data);
            console.log('VALUATION API RESPONSE:', result.data);
            setValuationMessage(
                result.message || 'Valuation calculation completed.'
            );

        } catch (error) {
            setValuationMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to calculate valuation.'
            );
        } finally {
            setCalculatingValuation(false);
        }
    };



    const handleValuationReview = async (
        decision: 'APPROVED' | 'REJECTED'
    ) => {
        if (!valuationResult?.valuationId) {
            setValuationReviewMessage(
                'Please calculate the valuation before submitting a review.'
            );
            return;
        }

        if (!managerReviewerName.trim()) {
            setValuationReviewMessage('Please enter the manager name.');
            return;
        }

        if (
            decision === 'APPROVED' &&
            (
                managerFinalValue.trim() === '' ||
                !Number.isFinite(Number(managerFinalValue)) ||
                Number(managerFinalValue) <= 0
            )
        ) {
            setValuationReviewMessage(
                'Please enter a valid final valuation amount.'
            );
            return;
        }

        if (decision === 'REJECTED' && !managerRemarks.trim()) {
            setValuationReviewMessage(
                'Please enter remarks explaining the rejection.'
            );
            return;
        }

        try {
            setSubmittingValuationReview(true);
            setValuationReviewMessage('');

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/valuation/${valuationResult.valuationId}/review`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        decision,
                        reviewerName: managerReviewerName.trim(),
                        ...(decision === 'APPROVED'
                            ? { finalValue: Number(managerFinalValue) }
                            : {}),
                        ...(managerRemarks.trim()
                            ? { remarks: managerRemarks.trim() }
                            : {}),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(result.message)
                        ? result.message.join(', ')
                        : result.message || 'Valuation review failed.'
                );
            }

            setValuationResult((previous: any) => ({
                ...previous,
                ...(result.data || {}),
                status: decision,
                finalValue:
                    decision === 'APPROVED'
                        ? Number(managerFinalValue)
                        : null,
            }));

            setValuationReviewMessage(
                decision === 'APPROVED'
                    ? 'Valuation approved successfully.'
                    : 'Valuation rejected successfully.'
            );

        } catch (error) {
            setValuationReviewMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to submit valuation review.'
            );
        } finally {
            setSubmittingValuationReview(false);
        }
    };



    const handleVehicleUpdate = async () => {
        if (!selectedVehicle) return;

        if (
            !editVehicleForm.year.trim() ||
            !editVehicleForm.odometer.trim()
        ) {
            alert('Please enter manufacturing year and odometer.');
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/details`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        registrationNumber: editVehicleForm.registrationNumber,
                        chassisNumber: editVehicleForm.chassisNumber,
                        engineNumber: editVehicleForm.engineNumber,
                        modelYear: Number(editVehicleForm.year),
                        odometerKm: Number(editVehicleForm.odometer),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Update failed');
            }

            const updatedVehicle = mapBackendVehicle(result.data);

            setRecords(prev =>
                prev.map(vehicle =>
                    vehicle.id === updatedVehicle.id
                        ? updatedVehicle
                        : vehicle
                )
            );

            setSelectedVehicle(updatedVehicle);
            setShowVehicleEdit(false);

            alert('Vehicle details updated successfully.');
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : 'Unable to update vehicle details.'
            );
        }
    };


    const handleDeleteVehicle = async (record: VehicleRecord) => {
        const confirmed = window.confirm(
            `Are you sure you want to permanently delete ${record.customer}'s vehicle ${record.vehicle}? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeletingVehicleId(record.id);

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${record.id}`,
                {
                    method: 'DELETE',
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete vehicle.');
            }

            setRecords((previous) =>
                previous.filter((vehicle) => vehicle.id !== record.id)
            );

            if (selectedVehicle?.id === record.id) {
                closeDrawer();
            }

            alert('Vehicle deleted successfully.');
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : 'Unable to delete vehicle.'
            );
        } finally {
            setDeletingVehicleId(null);
        }
    };


    const openVehicle = (record: VehicleRecord) => {
        setSelectedVehicle(record);

        setVerificationResult(null);

        // Restore the previously saved valuation result
        setValuationResult(null);
        setValuationMessage('');
        setEvaluatorQuotedValue('');
        setEvaluatorRemarks('');

        fetch(
            `http://localhost:3000/api/exchange-vehicles/${record.id}/valuation/latest`,
        )
            .then(async (response) => {
                if (!response.ok) return null;
                return response.json();
            })
            .then((result) => {
                const savedValuation = result?.data;

                const snapshot = savedValuation?.calculationSnapshot;

                setValuationResult(
                    savedValuation
                        ? {
                            ...snapshot,
                            ...savedValuation,
                            valuationId: savedValuation.id,

                            // Restore values used by the existing breakdown UI
                            basePrice: snapshot?.basePrice,
                            ageAdjustedValue: snapshot?.ageAdjustedValue,
                            mileageAdjustment:
                                snapshot?.mileage?.adjustmentPercentage,
                            conditionAdjustment:
                                snapshot?.condition?.adjustmentPercentage,
                            ownerDeduction:
                                snapshot?.owners?.adjustmentPercentage,
                            accidentRepaintAdjustment:
                                snapshot?.accidentRepaint?.adjustmentPercentage,
                            serviceHistoryPremium:
                                snapshot?.serviceHistory?.adjustmentPercentage,
                            rawAdjustmentPercentage:
                                snapshot?.rawAdjustmentPercentage,
                            finalAdjustmentPercentage:
                                snapshot?.finalAdjustmentPercentage,
                            deviationPercentage:
                                snapshot?.deviationPercentage,
                            deviationBand: snapshot?.deviationBand,
                            managerApprovalRequired:
                                snapshot?.managerApprovalRequired,
                        }
                        : null,
                );

                setEvaluatorQuotedValue(
                    savedValuation?.evaluatorQuotedValue != null
                        ? String(savedValuation.evaluatorQuotedValue)
                        : '',
                );

                setEvaluatorRemarks(
                    savedValuation?.evaluatorRemarks ?? '',
                );

                if (savedValuation) {
                    setValuationMessage('Previously saved valuation loaded.');
                }
            })
            .catch((error) => {
                console.error('Unable to restore saved valuation:', error);
                setValuationResult(null);
            });

        // Restore the previously saved RC Book verification result
        fetch(
            `http://localhost:3000/api/exchange-vehicles/${record.id}/rc-book/latest-verification`,
        )
            .then(async (response) => {
                if (!response.ok) return null;
                return response.json();
            })
            .then((result) => {
                const savedData = result?.data;

                setVerificationResult(savedData ?? null);
                setExtractedFields(savedData?.extractedFields ?? null);

                if (savedData?.comparison) {
                    const comparisons = savedData.comparison;

                    const getComparison = (field: string) => {
                        const item = comparisons.find(
                            (entry: any) => entry.field === field
                        );

                        return {
                            rcValue: item?.rcBookValue ?? null,
                            vehicleValue: item?.vehicleRecordValue ?? null,
                            status: item?.result ?? 'NOT_AVAILABLE',
                        };
                    };

                    setComparisonResults({
                        registrationNumber: getComparison('Registration Number'),
                        chassisNumber: getComparison('Chassis Number'),
                        engineNumber: getComparison('Engine Number'),
                        vehicleColour: getComparison('Vehicle Colour'),
                    });
                } else {
                    setComparisonResults(null);
                }
            })
            .catch((error) => {
                console.error('Unable to restore RC Book verification:', error);
                setVerificationResult(null);
            });

        fetchVehicleInspection(record.id);
        setScanMessage('');
        setScanResults(null);
        setComparisonResults(null);
        setExtractedFields(null);
        setExtractionSummary(null);
    };



    const scanRcBook = async () => {
        if (!selectedVehicle) return;

        try {
            setScanMessage('Processing RC Book documents... Please wait.');

            // Step 1: Extract text and fields from uploaded RC documents.
            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/rc-book/extract`,
                {
                    method: 'POST',
                },
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || 'RC Book text extraction failed',
                );
            }

            const documents = result.data.documents;

            setComparisonResults(result.data.comparison);
            setExtractedFields(result.data.extractedFields);
            setExtractionSummary(result.data.extractionSummary);

            const frontDocument = documents.find(
                (doc: any) => doc.documentType === 'RC_BOOK_FRONT',
            );

            const backDocument = documents.find(
                (doc: any) => doc.documentType === 'RC_BOOK_BACK',
            );

            setScanResults({
                front: frontDocument?.extractedText || 'No text extracted.',
                back: backDocument?.extractedText || 'No text extracted.',
            });

            // Step 2: Run configurable authenticity verification.
            const verificationResponse = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/rc-book/verify`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        extractedFields: result.data.extractedFields,
                    }),
                },
            );

            const verificationResult = await verificationResponse.json();

            if (!verificationResponse.ok) {
                throw new Error(
                    verificationResult.message ||
                    'RC Book verification failed',
                );
            }

            const verification = verificationResult.data;

            setVerificationResult(verification);

            setScanMessage(
                `Verification completed. Risk Score: ${verification.riskScore}/100 | Verdict: ${verification.riskVerdict.replace(/_/g, ' ')}`
            );

            // Refresh vehicle records so the updated RC Book status appears
            const vehiclesResponse = await fetch(
                'http://localhost:3000/api/exchange-vehicles'
            );

            if (vehiclesResponse.ok) {
                const vehiclesResult = await vehiclesResponse.json();
                const backendVehicles: BackendVehicle[] = vehiclesResult.data;
                const updatedRecords = backendVehicles.map(mapBackendVehicle);

                setRecords(updatedRecords);

                const updatedVehicle = updatedRecords.find(
                    (vehicle) => vehicle.id === selectedVehicle.id
                );

                if (updatedVehicle) {
                    setSelectedVehicle(updatedVehicle);
                }
            }

        } catch (error) {
            console.error('RC Book verification error:', error);

            setScanMessage(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong during RC Book verification.',
            );
        }
    };

    const handleRcBookReview = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!selectedVehicle || !verificationResult?.verificationId) {
            setReviewMessage('Verification record not found. Please scan the RC Book again.');
            return;
        }
        if (!reviewerName.trim()) {
            setReviewMessage('Please enter reviewer name.');
            return;
        }
        if (!reviewRemarks.trim()) {
            setReviewMessage('Please enter review remarks.');
            return;
        }
        if (!reviewStatus) {
            setReviewMessage('Please select a review decision.');
            return;
        }
        try {
            setSubmittingReview(true);
            setReviewMessage('');

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/rc-book/${verificationResult.verificationId}/review`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reviewStatus,
                        reviewerName: reviewerName.trim(),
                        reviewRemarks: reviewRemarks.trim(),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to complete RC Book review.');
            }

            setVerificationResult((previous) =>
                previous
                    ? {
                        ...previous,
                        reviewStatus: result.data.reviewStatus,
                    }
                    : previous
            );

            setReviewMessage('');
            setReviewerName('');
            setReviewRemarks('');
            setReviewStatus('');
            const vehiclesResponse = await fetch(
                'http://localhost:3000/api/exchange-vehicles'
            );

            if (vehiclesResponse.ok) {
                const vehiclesResult = await vehiclesResponse.json();
                const updatedRecords: VehicleRecord[] =
                    (vehiclesResult.data || []).map(mapBackendVehicle);

                setRecords(updatedRecords);

                const updatedVehicle = updatedRecords.find(
                    (vehicle) => vehicle.id === selectedVehicle.id
                );

                if (updatedVehicle) {
                    setSelectedVehicle(updatedVehicle);
                }
            }
        } catch (error) {
            setReviewMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to complete RC Book review.'
            );
        } finally {
            setSubmittingReview(false);
        }
    };

    const uploadRcDocument = async (
        file: File,
        documentType: 'RC_BOOK_FRONT' | 'RC_BOOK_BACK'
    ) => {
        if (!selectedVehicle) return false;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);

        try {
            setUploadingRcBook(true);
            setRcUploadMessage('');

            const response = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/documents`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Document upload failed.');
            }

            // Refresh uploaded document list
            const documentsResponse = await fetch(
                `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/documents`
            );

            if (!documentsResponse.ok) {
                throw new Error('Upload succeeded, but document list refresh failed.');
            }

            const documentsResult = await documentsResponse.json();
            setVehicleDocuments(documentsResult.data || []);

            setRcUploadMessage(
                `${documentType === 'RC_BOOK_FRONT' ? 'Front' : 'Back'} RC Book uploaded successfully.`
            );

            return true;
        } catch (error) {
            setRcUploadMessage(
                error instanceof Error ? error.message : 'Document upload failed.'
            );
            return false;
        } finally {
            setUploadingRcBook(false);
        }
    };

    const closeDrawer = () => {
        setSelectedVehicle(null);
        setScanMessage('');
    };

    useEffect(() => {
        if (!selectedVehicle) {
            setVehicleDocuments([]);
            return;
        }

        const fetchDocuments = async () => {
            try {
                setLoadingDocuments(true);

                const response = await fetch(
                    `http://localhost:3000/api/exchange-vehicles/${selectedVehicle.id}/documents`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch documents');
                }

                const result = await response.json();
                setVehicleDocuments(result.data || []);
            } catch (error) {
                console.error('Error fetching vehicle documents:', error);
                setVehicleDocuments([]);
            } finally {
                setLoadingDocuments(false);
            }
        };

        fetchDocuments();
    }, [selectedVehicle?.id]);

    return (
        <div className="exchange-vehicles-page">
            {intakeSuccess && (
                <p role="status" className="exchange-intake-success">
                    {intakeSuccess}
                </p>
            )}
            {loadingVehicles && (
                <p>Loading vehicles...</p>
            )}

            {apiError && (
                <p role="alert" style={{ color: 'red' }}>
                    Unable to load vehicles: {apiError}
                </p>
            )}
            <div className="exchange-vehicles-header">
                <div>
                    <h1>Exchange &amp; Used Vehicle Management</h1>
                    <p>
                        Inspection, AI-assisted valuation, RC Book authenticity
                        scanning, purchase/exchange approval, refurbishment and resale.
                    </p>
                </div>

                <div className="exchange-header-actions">
                    <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        hidden
                        id="rc-book-upload"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (!file) return;

                            const allowedTypes = [
                                "application/pdf",
                                "image/jpeg",
                                "image/png",
                            ];

                            const maxSize = 10 * 1024 * 1024; // 10 MB

                            if (!allowedTypes.includes(file.type)) {
                                setRcBookFile(null);
                                setScanMessage("Invalid file type. Please select a PDF, JPG, or PNG file.");
                                event.target.value = "";
                                return;
                            }

                            if (file.size > maxSize) {
                                setRcBookFile(null);
                                setScanMessage("File is too large. Maximum allowed size is 10 MB.");
                                event.target.value = "";
                                return;
                            }

                            setRcBookFile(file);
                            setScanMessage(`RC Book selected: ${file.name}`);
                        }}
                    />

                    <div className="rc-book-upload-group">
                        {/* <button
                            type="button"
                            className="exchange-upload-button"
                            onClick={() =>
                                document.getElementById("rc-book-upload")?.click()
                            }
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 16V4" />
                                <path d="m7 9 5-5 5 5" />
                                <path d="M20 16v4H4v-4" />
                            </svg>
                            <span>Upload RC Book</span>
                        </button> */}

                        {rcBookFile && (
                            <span className="rc-book-selected-file">
                                📄 {rcBookFile.name}
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        className="exchange-new-button"
                        onClick={openIntakeForm}
                    >
                        + New Exchange Intake
                    </button>
                </div>
            </div>

            <div className="exchange-vehicles-summary">
                <div className="exchange-summary-card">
                    <span>IN PIPELINE</span>
                    <strong>{inPipeline}</strong>
                </div>

                <div className="exchange-summary-card">
                    <span>RESOLD</span>
                    <strong>{resoldCount}</strong>
                </div>

                <div className="exchange-summary-card">
                    <span>AVG. AI VALUATION</span>
                    <strong>
                        {averageValuation !== null
                            ? `₹${(averageValuation / 100000).toFixed(2)} L`
                            : '—'}
                    </strong>
                </div>

                <div className="exchange-summary-card">
                    <span>RC BOOK: HIGH RISK FLAGGED</span>
                    <strong>{highRiskCount}</strong>
                </div>
            </div>

            <div className="exchange-main-grid">
                <section className="exchange-panel exchange-pipeline-panel">
                    <h2>Pipeline by Stage</h2>

                    {pipelineStages.map((stage) => {
                        const count = stageCount(stage);
                        const percentage =
                            records.length > 0
                                ? (count / records.length) * 100
                                : 0;

                        return (
                            <div className="exchange-pipeline-row" key={stage}>
                                <div className="exchange-pipeline-label">
                                    <span>{stage}</span>
                                    <strong>{count}</strong>
                                </div>

                                <div className="exchange-progress-track">
                                    <div
                                        className="exchange-progress-fill"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </section>

                <section className="exchange-panel exchange-scanner-panel">
                    <div className="exchange-scanner-heading">
                        <h2>🔍 RC Book Authenticity Scanner</h2>
                        <span>
                            {scannedCount}/{records.length} scanned
                        </span>
                    </div>

                    <p>
                        Checks each intake&apos;s Registration Certificate for
                        tampering signals — font/format inconsistency, missing
                        security hologram, and chassis/engine alteration
                        patterns — before the dealership commits to a purchase.
                        Click a record below, then <strong>Scan RC Book</strong>{' '}
                        in the detail panel.
                    </p>

                    <div className="exchange-scanner-badges">
                        <span className="exchange-badge genuine">
                            ● {genuineCount} Genuine
                        </span>
                        <span className="exchange-badge verification">
                            ● {verificationCount} Needs Verification
                        </span>
                        <span className="exchange-badge risk">
                            ● {highRiskCount} High Risk
                        </span>
                        <span className="exchange-badge unscanned">
                            ● {records.length - scannedCount} Not Scanned
                        </span>
                    </div>
                </section>
            </div>

            <section className="exchange-vehicle-list">
                <div className="exchange-table-toolbar">
                    <div className="exchange-search-box">
                        <span className="exchange-search-icon" aria-hidden="true">
                            ⌕
                        </span>

                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setCurrentPage(1);
                            }}
                            aria-label="Search vehicles"
                        />
                    </div>

                    <select
                        value={stageFilter}
                        onChange={(event) => {
                            setStageFilter(event.target.value);
                            setCurrentPage(1);
                        }}
                        aria-label="Filter by stage"
                    >
                        <option value="All">Stage: All</option>
                        {pipelineStages.map((stage) => (
                            <option key={stage} value={stage}>
                                {stage}
                            </option>
                        ))}
                    </select>

                    <span className="exchange-record-count">
                        {filteredVehicles.length} records
                    </span>
                </div>

                <div className="exchange-table-wrapper">
                    <table className="exchange-vehicle-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Vehicle</th>
                                <th>Odometer</th>
                                <th>Score</th>
                                <th>AI Valuation</th>
                                <th>RC Book</th>
                                <th>Stage</th>



                            </tr>
                        </thead>

                        <tbody>
                            {visibleVehicles.length > 0 ? (
                                visibleVehicles.map((record) => (
                                    <tr
                                        key={record.id}
                                        onClick={() => openVehicle(record)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{record.customer}</td>
                                        <td>{record.vehicle}</td>
                                        <td>{record.odometer}</td>
                                        <td>{record.score}</td>
                                        <td>{formatMoney(record.aiValuation)}</td>

                                        <td>
                                            <button
                                                type="button"
                                                className={`exchange-status ${record.rcBook === 'Not Scanned'
                                                    ? 'unscanned'
                                                    : record.rcBook === 'Genuine'
                                                        ? 'stage-resold'
                                                        : record.rcBook === 'High Risk'
                                                            ? 'risk'
                                                            : 'verification'
                                                    }`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openVehicle(record);
                                                }}
                                            >
                                                ● {record.rcBook}
                                            </button>
                                        </td>

                                        <td>
                                            <div className="exchange-stage-cell">
                                                <span
                                                    className={`exchange-status ${getStageClass(
                                                        record.stage,
                                                    )}`}
                                                >
                                                    ● {record.stage}
                                                </span>

                                                <button
                                                    type="button"
                                                    className="exchange-delete-button"
                                                    title="Delete vehicle"
                                                    aria-label={`Delete ${record.vehicle}`}
                                                    disabled={deletingVehicleId === record.id}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteVehicle(record);
                                                    }}
                                                >
                                                    {deletingVehicleId === record.id ? '...' : '🗑'}
                                                </button>
                                            </div>
                                        </td>



                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="exchange-empty-state">
                                        No vehicles found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination inside the same table wrapper */}
                    <div className="exchange-pagination">
                        <span className="exchange-pagination-page">
                            Page {currentPage} of {totalPages}
                        </span>

                        <div className="exchange-pagination-buttons">
                            <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={() =>
                                    setCurrentPage((page) => Math.max(1, page - 1))
                                }
                            >
                                ← Prev
                            </button>

                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.min(totalPages, page + 1),
                                    )
                                }
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {selectedVehicle && (
                <div
                    className="exchange-drawer-overlay"
                    onClick={closeDrawer}
                >
                    <aside
                        className="exchange-vehicle-drawer"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="exchange-drawer-header">
                            <div>
                                <h2>{selectedVehicle.vehicle}</h2>
                                <p>{selectedVehicle.customer}</p>
                            </div>

                            <button
                                type="button"
                                className="exchange-drawer-close"
                                onClick={closeDrawer}
                                aria-label="Close vehicle details"
                            >
                                ×
                            </button>
                        </div>

                        <div className="exchange-drawer-content">

                            {loadingDocuments ? (
                                <div className="exchange-drawer-notice">
                                    <strong>Checking RC Book Documents</strong>
                                    <p>Please wait while uploaded documents are checked.</p>
                                </div>
                            ) : !vehicleDocuments.some(
                                (document) =>
                                    document.documentType === 'RC_BOOK_FRONT' ||
                                    document.documentType === 'RC_BOOK_BACK'
                            ) ? (
                                <div className="exchange-drawer-notice">
                                    <strong>RC Book Upload Pending</strong>
                                    <p>Upload the RC Book Front and Back documents to begin verification.</p>
                                </div>
                            ) : scanResults ? (
                                <div className="exchange-drawer-notice">
                                    <strong>RC Book Extraction Results Available</strong>
                                    <p>
                                        Document information has been extracted. Review the
                                        extracted fields and verification findings below.
                                    </p>
                                </div>
                            ) : verificationResult ? (
                                <div className="exchange-drawer-notice">
                                    <strong>RC Book Assessment Available</strong>
                                    <p>
                                        A previously saved verification assessment is available.
                                        Review its findings below. Scan again if updated document
                                        information is required.
                                    </p>
                                </div>
                            ) : (
                                <div className="exchange-drawer-notice">
                                    <strong>RC Book Scanning Pending</strong>
                                    <p>
                                        Scan the uploaded RC Book documents to extract information
                                        and generate a verification assessment.
                                    </p>
                                </div>
                            )}



                            <div className="exchange-detail-section-title">
                                <div className="exchange-detail-heading">
                                    <div>
                                        <h3>Vehicle & Registration Details</h3>
                                        <p>Vehicle identity and registration information</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="exchange-edit-trigger"
                                        onClick={() => {
                                            setEditVehicleForm({
                                                registrationNumber: selectedVehicle.registrationNumber || '',
                                                chassisNumber: selectedVehicle.chassisNumber || '',
                                                engineNumber: selectedVehicle.engineNumber || '',
                                                year: String(selectedVehicle.year || ''),
                                                odometer: String(
                                                    Number(String(selectedVehicle.odometer || '0').replace(/[^0-9]/g, ''))
                                                ),
                                            });
                                            setShowVehicleEdit(true);
                                        }}
                                    >
                                        Edit Details
                                    </button>
                                </div>
                            </div>



                            {showVehicleEdit && (
                                <div className="exchange-edit-form">
                                    <div className="exchange-edit-header">
                                        <div>
                                            <h3>Edit Vehicle Details</h3>
                                            <p>Update vehicle registration and identification information.</p>
                                        </div>
                                    </div>

                                    <div className="exchange-edit-grid">
                                        {([
                                            ['registrationNumber', 'Registration Number'],
                                            ['chassisNumber', 'Chassis Number'],
                                            ['engineNumber', 'Engine Number'],
                                            ['year', 'Year of Manufacture'],
                                            ['odometer', 'Odometer (km)'],
                                        ] as const).map(([key, label]) => (
                                            <div className="exchange-edit-field" key={key}>
                                                <label htmlFor={`edit-${key}`}>{label}</label>
                                                <input
                                                    id={`edit-${key}`}
                                                    type="text"
                                                    value={editVehicleForm[key]}
                                                    onChange={(e) =>
                                                        setEditVehicleForm(prev => ({
                                                            ...prev,
                                                            [key]: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="exchange-edit-actions">
                                        <button
                                            type="button"
                                            className="exchange-edit-cancel"
                                            onClick={() => setShowVehicleEdit(false)}
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="button"
                                            className="exchange-edit-save"
                                            onClick={handleVehicleUpdate}
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}


                            <div className="exchange-detail-row">
                                <span>Branch</span>
                                <strong>{selectedVehicle.branch}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Registration Number</span>
                                <strong>{selectedVehicle.registrationNumber || 'Not provided'}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Chassis Number</span>
                                <strong>{selectedVehicle.chassisNumber || 'Not provided'}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Engine Number</span>
                                <strong>{selectedVehicle.engineNumber || 'Not provided'}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Year of Mfg</span>
                                <strong>{selectedVehicle.year}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Odometer</span>
                                <strong>{selectedVehicle.odometer}</strong>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Inspection Score</span>
                                <strong>
                                    {selectedVehicle.score != null
                                        ? `${selectedVehicle.score} / 100`
                                        : 'Not inspected'}
                                </strong>
                            </div>


                            <div className="exchange-detail-section-title">
                                <h3>Vehicle Valuation</h3>
                                <p>AI-assisted valuation and manager approval</p>
                            </div>

                            <div className="ev-valuation-summary">
                                <div className="ev-valuation-metric">
                                    <span>Suggested Value</span>
                                    <strong className="ev-valuation-amount">
                                        {formatMoney(
                                            valuationResult?.suggestedValue ??
                                            selectedVehicle.aiValuation
                                        )}
                                    </strong>
                                    <small>System calculated estimate</small>
                                </div>

                                <div className="ev-valuation-metric">
                                    <span>Manager Approved Value</span>
                                    <strong>
                                        {formatMoney(
                                            valuationResult?.status === 'APPROVED'
                                                ? valuationResult.finalValue
                                                : selectedVehicle.finalValuation
                                        )}
                                    </strong>
                                    <small>Final approved amount</small>
                                </div>

                                <div className="ev-valuation-metric">
                                    <span>Listed Price</span>
                                    <strong>{formatMoney(selectedVehicle.listedPrice)}</strong>
                                    <small>Current listing amount</small>
                                </div>
                            </div>

                            <div className="exchange-detail-row">
                                <span>Stage</span>
                                <strong>
                                    <span
                                        className={`exchange-status ${getStageClass(
                                            selectedVehicle.stage,
                                        )}`}
                                    >
                                        ● {selectedVehicle.stage}
                                    </span>
                                </strong>
                            </div>

                            <div className="ev-valuation-card">
                                <div className="ev-valuation-card-heading">
                                    <div>
                                        <h4>Evaluator Assessment</h4>
                                        <p>Enter the evaluator's proposed price and supporting remarks.</p>
                                    </div>
                                    <span className="ev-valuation-step">01</span>
                                </div>

                                <div className="ev-valuation-form-grid">
                                    <div className="ev-valuation-field">
                                        <label htmlFor="evaluatorQuotedValue">
                                            Evaluator Quoted Value (₹)
                                        </label>
                                        <input
                                            id="evaluatorQuotedValue"
                                            type="number"
                                            min="0"
                                            value={evaluatorQuotedValue}
                                            onChange={(e) => setEvaluatorQuotedValue(e.target.value)}
                                            placeholder="Enter proposed amount"
                                        />
                                    </div>

                                    <div className="ev-valuation-field ev-valuation-field-full">
                                        <label htmlFor="evaluatorRemarks">
                                            Evaluator Remarks
                                        </label>
                                        <textarea
                                            id="evaluatorRemarks"
                                            rows={3}
                                            value={evaluatorRemarks}
                                            onChange={(e) => setEvaluatorRemarks(e.target.value)}
                                            placeholder="Explain the proposed price or any special observations..."
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="ev-valuation-primary-button"
                                    onClick={handleCalculateValuation}
                                    disabled={calculatingValuation}
                                >
                                    {calculatingValuation
                                        ? 'Calculating Valuation...'
                                        : 'Calculate Valuation'}
                                </button>

                                {valuationMessage && (
                                    <div
                                        className={`ev-valuation-message ${valuationResult ? 'success' : 'error'
                                            }`}
                                        role="status"
                                    >
                                        {valuationMessage}
                                    </div>
                                )}
                            </div>

                            {valuationResult && (
                                <div className="ev-valuation-card">
                                    <div className="ev-valuation-card-heading">
                                        <div>
                                            <h4>Valuation Calculation Breakdown</h4>
                                            <p>Detailed breakdown generated by the valuation engine.</p>
                                        </div>
                                        <span className="ev-valuation-step">02</span>
                                    </div>

                                    <div className="ev-valuation-breakdown">
                                        <div>
                                            <span>Base Reference Price</span>
                                            <strong>{formatMoney(valuationResult.basePrice)}</strong>
                                        </div>

                                        <div>
                                            <span>Age Adjusted Value</span>
                                            <strong>{formatMoney(valuationResult.ageAdjustedValue)}</strong>
                                        </div>

                                        <div>
                                            <span>Mileage Adjustment</span>
                                            <strong>{valuationResult.mileageAdjustment ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Condition Adjustment</span>
                                            <strong>{valuationResult.conditionAdjustment ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Previous Owner Deduction</span>
                                            <strong>{valuationResult.ownerDeduction ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Accident / Repaint Adjustment</span>
                                            <strong>{valuationResult.accidentRepaintAdjustment ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Service History Premium</span>
                                            <strong>{valuationResult.serviceHistoryPremium ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Raw Adjustment</span>
                                            <strong>{valuationResult.rawAdjustmentPercentage ?? '—'}%</strong>
                                        </div>

                                        <div>
                                            <span>Applied Adjustment</span>
                                            <strong>{valuationResult.finalAdjustmentPercentage ?? '—'}%</strong>
                                        </div>

                                        {valuationResult.evaluatorQuotedValue != null && (
                                            <div>
                                                <span>Evaluator Quoted Value</span>
                                                <strong>{formatMoney(valuationResult.evaluatorQuotedValue)}</strong>
                                            </div>
                                        )}

                                        {valuationResult.deviationPercentage != null && (
                                            <div>
                                                <span>Evaluator Deviation</span>
                                                <strong>
                                                    {valuationResult.deviationPercentage}%
                                                    {valuationResult.deviationBand
                                                        ? ` (${valuationResult.deviationBand})`
                                                        : ''}
                                                </strong>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ev-valuation-suggested">
                                        <span>Suggested Valuation</span>
                                        <strong>{formatMoney(valuationResult.suggestedValue)}</strong>
                                    </div>

                                    <div className="ev-valuation-status-row">
                                        <span>Valuation Status</span>
                                        <span className={`ev-valuation-status ${String(valuationResult.status || '').toLowerCase()}`}>
                                            {String(valuationResult.status || 'UNKNOWN').replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <div className="ev-valuation-status-row">
                                        <span>Manager Approval Required</span>
                                        <strong>
                                            {valuationResult.managerApprovalRequired ? 'Yes' : 'No'}
                                        </strong>
                                    </div>

                                    <div className="ev-valuation-status-row">
                                        <span>Final Approved Value</span>
                                        <strong>
                                            {valuationResult.finalValue != null
                                                ? formatMoney(valuationResult.finalValue)
                                                : 'Awaiting manager approval'}
                                        </strong>
                                    </div>

                                    {valuationResult.adjustmentOutsideCap && (
                                        <div className="ev-valuation-message warning">
                                            Adjustment is outside the permitted range. Additional review is required.
                                        </div>
                                    )}
                                </div>
                            )}

                            {valuationResult?.status === 'PENDING_APPROVAL' && (
                                <div className="ev-valuation-card ev-manager-approval">
                                    <div className="ev-valuation-card-heading">
                                        <div>
                                            <h4>Manager Valuation Approval</h4>
                                            <p>Review the suggested amount and enter one final approved valuation.</p>
                                        </div>
                                        <span className="ev-valuation-step">03</span>
                                    </div>

                                    <div className="ev-valuation-form-grid">
                                        <div className="ev-valuation-field">
                                            <label htmlFor="managerReviewerName">Manager Name</label>
                                            <input
                                                id="managerReviewerName"
                                                type="text"
                                                value={managerReviewerName}
                                                onChange={(e) => setManagerReviewerName(e.target.value)}
                                                placeholder="Enter manager name"
                                            />
                                        </div>

                                        <div className="ev-valuation-field">
                                            <label htmlFor="managerFinalValue">
                                                Final Approved Valuation (₹)
                                            </label>
                                            <input
                                                id="managerFinalValue"
                                                type="number"
                                                min="0.01"
                                                value={managerFinalValue}
                                                onChange={(e) => setManagerFinalValue(e.target.value)}
                                                placeholder="Enter final amount"
                                            />
                                        </div>

                                        <div className="ev-valuation-field ev-valuation-field-full">
                                            <label htmlFor="managerRemarks">Manager Remarks</label>
                                            <textarea
                                                id="managerRemarks"
                                                rows={3}
                                                value={managerRemarks}
                                                onChange={(e) => setManagerRemarks(e.target.value)}
                                                placeholder="Enter approval or rejection remarks..."
                                            />
                                        </div>
                                    </div>

                                    <div className="ev-valuation-manager-actions">
                                        <button
                                            type="button"
                                            className="ev-valuation-approve-button"
                                            onClick={() => handleValuationReview('APPROVED')}
                                            disabled={submittingValuationReview}
                                        >
                                            {submittingValuationReview ? 'Submitting...' : 'Approve Valuation'}
                                        </button>

                                        <button
                                            type="button"
                                            className="ev-valuation-reject-button"
                                            onClick={() => handleValuationReview('REJECTED')}
                                            disabled={submittingValuationReview}
                                        >
                                            Reject Valuation
                                        </button>
                                    </div>
                                </div>
                            )}


                            {valuationResult?.status === 'APPROVED' && (
                                <>
                                    <div className="ev-valuation-message success">
                                        Valuation approved. Final approved amount: {formatMoney(valuationResult.finalValue)}
                                    </div>

                                    {valuationResult?.approvals
                                        ?.filter((approval: any) => approval.decision === 'APPROVED')
                                        .map((approval: any) => (
                                            <div
                                                className="ev-valuation-card ev-manager-approval"
                                                key={approval.id}
                                            >
                                                <div className="ev-valuation-card-heading">
                                                    <div>
                                                        <h4>Manager Approval Details</h4>
                                                        <p>Final valuation approval recorded successfully.</p>
                                                    </div>
                                                    <span className="ev-valuation-step">03</span>
                                                </div>

                                                <div className="ev-valuation-form-grid">
                                                    <div className="ev-valuation-field">
                                                        <label>Approval Decision</label>
                                                        <div>APPROVED</div>
                                                    </div>

                                                    <div className="ev-valuation-field">
                                                        <label>Manager Name</label>
                                                        <div>{approval.reviewerName || '—'}</div>
                                                    </div>

                                                    <div className="ev-valuation-field">
                                                        <label>Final Approved Valuation</label>
                                                        <div>{formatMoney(valuationResult.finalValue)}</div>
                                                    </div>

                                                    <div className="ev-valuation-field">
                                                        <label>Approved On</label>
                                                        <div>
                                                            {approval.decidedAt
                                                                ? new Date(approval.decidedAt).toLocaleString('en-IN')
                                                                : '—'}
                                                        </div>
                                                    </div>

                                                    <div className="ev-valuation-field ev-valuation-field-full">
                                                        <label>Manager Remarks</label>
                                                        <div>
                                                            {approval.remarks || 'No remarks provided.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </>
                            )}


                            {valuationResult?.status === 'REJECTED' && (
                                <div className="ev-valuation-message error">
                                    This valuation has been rejected. Recalculate and submit a new valuation if required.
                                </div>
                            )}

                            {valuationReviewMessage && (
                                <p className="ev-valuation-message" role="status">
                                    {valuationReviewMessage}
                                </p>
                            )}







                            {/* <div className="exchange-detail-row">
                                <span>Stage</span>
                                <strong>
                                    <span
                                        className={`exchange-status ${getStageClass(
                                            selectedVehicle.stage,
                                        )}`}
                                    >
                                        ● {selectedVehicle.stage}
                                    </span>
                                </strong>
                            </div> */}

                            {scanMessage && !verificationResult && (
                                <p className="exchange-scan-message">
                                    {scanMessage}
                                </p>
                            )}

                            {verificationResult && (
                                <div className="rc-verification-report">
                                    <div className="rc-verification-header">
                                        <h3>RC Book Risk Assessment</h3>
                                        <span className={`rc-risk-verdict ${verificationResult.riskVerdict.toLowerCase()}`}>
                                            {verificationResult.riskVerdict.replace(/_/g, ' ')}
                                        </span>
                                    </div>





                                    {verificationResult.reviewStatus !== 'APPROVED' &&
                                        verificationResult.reviewStatus !== 'REJECTED' && (
                                            <div className="rc-authenticity-status">
                                                <strong>Assessment Status:</strong>
                                                <span>
                                                    {verificationResult.assessmentStatus === 'BLOCKED'
                                                        ? 'Blocked — Synthetic Test Document'
                                                        : verificationResult.assessmentStatus === 'MANUAL_REVIEW'
                                                            ? 'Manual Review Required'
                                                            : verificationResult.assessmentStatus === 'CLEAR'
                                                                ? 'Clear'
                                                                : 'Status Not Available'}
                                                </span>
                                            </div>
                                        )}



                                    <div className="rc-risk-score">
                                        <div>
                                            <span>Risk Score</span>
                                            <strong>{verificationResult.riskScore}/100</strong>
                                        </div>

                                        <div className="rc-risk-progress">
                                            <div
                                                style={{
                                                    width: `${Math.min(Math.max(verificationResult.riskScore, 0), 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <p>
                                        <strong>Manual Review Status:</strong>{" "}
                                        {verificationResult.reviewStatus.replace(/_/g, " ")}
                                    </p>

                                    <h4>Risk Flags</h4>
                                    {verificationResult.flags.length > 0 ? (
                                        verificationResult.flags.map((flag, index) => (
                                            <div className="rc-risk-flag" key={`${flag.ruleKey}-${index}`}>
                                                <strong>{flag.ruleName}</strong>
                                                <span>Weight: {flag.weight}</span>
                                                <p>{flag.message}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p>No risk flags detected by the configured rules.</p>
                                    )}



                                    <p className="rc-verification-note">
                                        {verificationResult.note}
                                    </p>

                                    {verificationResult.reviewStatus === 'PENDING' &&
                                        (
                                            verificationResult.assessmentStatus === 'BLOCKED' ||
                                            verificationResult.authenticityStatus === 'SYNTHETIC_TEST_DOCUMENT'
                                        ) && (
                                            <div className="rc-verification-note" role="status">
                                                <strong>Approval Unavailable</strong>
                                                <p>
                                                    This document is blocked because it has been identified
                                                    as synthetic test data. It cannot be approved as a genuine
                                                    RC Book. Please use a valid vehicle document for verification.
                                                </p>
                                            </div>
                                        )}

                                    {verificationResult.reviewStatus === 'PENDING' &&
                                        verificationResult.assessmentStatus !== 'BLOCKED' &&
                                        verificationResult.authenticityStatus !== 'SYNTHETIC_TEST_DOCUMENT' && (
                                            <form
                                                className="rc-manual-review-form"
                                                onSubmit={handleRcBookReview}
                                            >
                                                <h4>Manual RC Book Review</h4>

                                                <label>
                                                    Reviewer Name
                                                    <input
                                                        type="text"
                                                        value={reviewerName}
                                                        onChange={(e) => setReviewerName(e.target.value)}
                                                        placeholder="Enter reviewer name"
                                                        required
                                                    />
                                                </label>

                                                <label>
                                                    Review Decision
                                                    <select
                                                        value={reviewStatus}
                                                        onChange={(e) =>
                                                            setReviewStatus(
                                                                e.target.value as
                                                                | 'APPROVED'
                                                                | 'REJECTED'
                                                                | 'NEEDS_RESUBMISSION'
                                                            )
                                                        }
                                                        required
                                                    >
                                                        <option value="">Select decision</option>
                                                        <option value="APPROVED">Approve</option>
                                                        <option value="REJECTED">Reject</option>
                                                        <option value="NEEDS_RESUBMISSION">
                                                            Request Resubmission
                                                        </option>
                                                    </select>
                                                </label>

                                                <label>
                                                    Review Remarks
                                                    <textarea
                                                        value={reviewRemarks}
                                                        onChange={(e) => setReviewRemarks(e.target.value)}
                                                        placeholder="Enter review observations and reason..."
                                                        rows={3}
                                                        required
                                                    />
                                                </label>

                                                <button type="submit" disabled={submittingReview}>
                                                    {submittingReview ? 'Submitting Review...' : 'Submit Review'}
                                                </button>

                                                {reviewMessage && (
                                                    <p role="status">{reviewMessage}</p>
                                                )}
                                            </form>
                                        )}

                                    {verificationResult.reviewStatus !== 'PENDING' && (
                                        <div className="rc-review-completed">
                                            <strong className="rc-review-title">Manual Review Details</strong>

                                            <div className="rc-review-grid">
                                                <div className="rc-review-row">
                                                    <span>Review Decision</span>
                                                    <strong>{verificationResult.reviewStatus.replace(/_/g, ' ')}</strong>
                                                </div>

                                                {verificationResult.reviewerName && (
                                                    <div className="rc-review-row">
                                                        <span>Reviewed By</span>
                                                        <strong>{verificationResult.reviewerName}</strong>
                                                    </div>
                                                )}

                                                {verificationResult.reviewedAt && (
                                                    <div className="rc-review-row">
                                                        <span>Reviewed On</span>
                                                        <strong>
                                                            {new Date(verificationResult.reviewedAt).toLocaleString()}
                                                        </strong>
                                                    </div>
                                                )}

                                                {verificationResult.reviewRemarks && (
                                                    <div className="rc-review-remarks">
                                                        <span>Review Remarks</span>
                                                        <p>{verificationResult.reviewRemarks}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(scanResults || extractedFields) && (
                                <div className="rc-ocr-results">
                                    <h4>RC Book Extraction Results</h4>

                                    {extractedFields && (
                                        <div className="rc-extracted-fields">
                                            <details className="rc-extracted-details">
                                                <summary>View extracted RC details</summary>
                                                <h5>Extracted RC Details</h5>

                                                {Object.entries(extractedFields).map(([field, value]) => (
                                                    <div className="rc-extracted-field-row" key={field}>
                                                        <strong>
                                                            {field.replace(/([A-Z])/g, ' $1')}
                                                        </strong>

                                                        <span>
                                                            {value || (
                                                                field === 'hypothecationDetails'
                                                                    ? (extractedFields.financierName || 'Not detected')
                                                                    : 'Not detected'
                                                            )}
                                                        </span>

                                                    </div>
                                                ))}

                                                {extractionSummary?.lowConfidenceDocuments &&
                                                    extractionSummary.lowConfidenceDocuments.length > 0 && (
                                                        <div className="rc-ocr-warning">
                                                            <strong>Low OCR Confidence — Manual Verification Required</strong>

                                                            {extractionSummary.lowConfidenceDocuments.map((doc) => (
                                                                <p key={doc.documentType}>
                                                                    {doc.documentType.replace(/_/g, ' ')}:
                                                                    {' '}
                                                                    {doc.confidence.toFixed(0)}% confidence.
                                                                    {' '}
                                                                    {doc.message}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                            </details>
                                        </div>

                                    )}



                                    {verificationResult?.reviewStatus?.toUpperCase() === 'APPROVED' ? (
                                        <p className="rc-ocr-notice">
                                            Manual verification completed and approved. Document authenticity
                                            has been reviewed by the authorised reviewer.
                                        </p>
                                    ) : (
                                        <p className="rc-ocr-notice">
                                            Text extraction does not confirm document authenticity.
                                            Manual verification is still required.
                                        </p>
                                    )}


                                    {comparisonResults &&
                                        Object.values(comparisonResults).some(
                                            (result) => result.status?.toLowerCase() !== 'match'
                                        ) && (
                                            <div className="rc-comparison-results">
                                                <h4>RC Book vs Vehicle Record Comparison</h4>

                                                {Object.entries(comparisonResults)
                                                    .filter(([, result]) => result.status?.toLowerCase() !== 'match')
                                                    .map(([field, result]) => {
                                                        const rcValue = String(result.rcValue ?? '')
                                                            .replace(/[^a-z0-9]/gi, '')
                                                            .toUpperCase();

                                                        const vehicleValue = String(result.vehicleValue ?? '')
                                                            .replace(/[^a-z0-9]/gi, '')
                                                            .toUpperCase();

                                                        const manuallyCleared =
                                                            verificationResult?.reviewStatus?.toUpperCase() === 'APPROVED' &&
                                                            rcValue.length > 0 &&
                                                            rcValue === vehicleValue;

                                                        const displayStatus = manuallyCleared
                                                            ? 'REVIEWED – MATCH CONFIRMED'
                                                            : result.status;

                                                        return (
                                                            <div className="rc-comparison-row" key={field}>
                                                                <strong>
                                                                    {field.replace(/([A-Z])/g, ' $1')}
                                                                </strong>

                                                                <span>RC Book: {result.rcValue ?? 'Not found'}</span>

                                                                <span>
                                                                    Vehicle Record: {result.vehicleValue ?? 'Not available'}
                                                                </span>

                                                                <span
                                                                    className={
                                                                        manuallyCleared
                                                                            ? 'rc-match'
                                                                            : result.status === 'MATCH'
                                                                                ? 'rc-match'
                                                                                : result.status === 'POSSIBLE_OCR_ERROR'
                                                                                    ? 'rc-ocr-warning'
                                                                                    : 'rc-mismatch'
                                                                    }
                                                                >
                                                                    {displayStatus}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                </div>

                            )}

                            <section className="exchange-inspection-section">
                                <div className="exchange-inspection-header">
                                    <div>
                                        <h3>Vehicle Inspection</h3>
                                        <p>Record the physical condition and inspection findings.</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!showInspectionForm) {
                                                setAccidentHistorySelection(
                                                    inspection?.accidentHistory === true
                                                        ? 'true'
                                                        : inspection?.accidentHistory === false
                                                            ? 'false'
                                                            : ''
                                                );

                                                setRepaintHistorySelection(
                                                    inspection?.repaintHistory === true
                                                        ? 'true'
                                                        : inspection?.repaintHistory === false
                                                            ? 'false'
                                                            : ''
                                                );

                                                setAccidentSeveritySelection(inspection?.accidentSeverity || '');
                                                setRepaintCoverageSelection(inspection?.repaintCoverage || '');
                                            }

                                            setShowInspectionForm((prev) => !prev);
                                        }}
                                    >
                                        {showInspectionForm ? 'Cancel' : inspection ? 'Update Inspection' : 'Add Inspection'}
                                    </button>
                                </div>

                                {loadingInspection && <p>Loading inspection details...</p>}

                                {inspection && !showInspectionForm && (
                                    <div className="exchange-inspection-details">
                                        <p><strong>Condition:</strong> {inspection.condition}</p>
                                        <p><strong>Inspection Score:</strong> {inspection.inspectionScore}/100</p>

                                        <p>
                                            <strong>Accident History:</strong>{' '}
                                            {inspection.accidentHistory === null
                                                ? 'Not verified'
                                                : inspection.accidentHistory ? 'Yes' : 'No'}
                                        </p>

                                        <p>
                                            <strong>Repaint History:</strong>{' '}
                                            {inspection.repaintHistory === null
                                                ? 'Not verified'
                                                : inspection.repaintHistory ? 'Yes' : 'No'}
                                        </p>

                                        <p><strong>Accident Severity:</strong> {inspection.accidentSeverity || 'Not specified'}</p>

                                        <p><strong>Repaint Coverage:</strong> {inspection.repaintCoverage || 'Not specified'}</p>

                                        <p>
                                            <strong>Full Service History:</strong>{' '}
                                            {inspection.fullServiceHistory === null
                                                ? 'Not verified'
                                                : inspection.fullServiceHistory ? 'Yes' : 'No'}
                                        </p>
                                        <p><strong>Notes:</strong> {inspection.notes || 'No notes added'}</p>
                                    </div>
                                )}

                                {!inspection && !loadingInspection && !showInspectionForm && (
                                    <p>No inspection has been recorded for this vehicle yet.</p>
                                )}

                                {showInspectionForm && (
                                    <form onSubmit={handleInspectionSubmit} className="exchange-inspection-form">
                                        <div className="exchange-inspection-field">
                                            <label>Vehicle Condition</label>
                                            <select name="condition" defaultValue={inspection?.condition || 'GOOD'} required>
                                                <option value="EXCELLENT">Excellent</option>
                                                <option value="GOOD">Good</option>
                                                <option value="FAIR">Fair</option>
                                                <option value="POOR">Poor</option>
                                                <option value="VERY_POOR">Very Poor</option>
                                            </select>
                                        </div>

                                        <div className="exchange-inspection-field">
                                            <label>Inspection Score (0–100)</label>
                                            <input
                                                type="number"
                                                name="inspectionScore"
                                                min="0"
                                                max="100"
                                                defaultValue={inspection?.inspectionScore ?? 75}
                                                required
                                            />
                                        </div>

                                        <div className="exchange-inspection-field">
                                            <label>Accident History</label>
                                            <select
                                                name="accidentHistory"
                                                value={accidentHistorySelection}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setAccidentHistorySelection(value);

                                                    if (value !== 'true') {
                                                        setAccidentSeveritySelection('');
                                                    }
                                                }}
                                            >
                                                <option value="">Not verified</option>
                                                <option value="true">Yes</option>
                                                <option value="false">No</option>
                                            </select>
                                        </div>

                                        <div className="exchange-inspection-field">
                                            <label>Repaint History</label>
                                            <select
                                                name="repaintHistory"
                                                value={repaintHistorySelection}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setRepaintHistorySelection(value);

                                                    if (value !== 'true') {
                                                        setRepaintCoverageSelection('');
                                                    }
                                                }}
                                            >
                                                <option value="">Not verified</option>
                                                <option value="true">Yes</option>
                                                <option value="false">No</option>
                                            </select>
                                        </div>

                                        <div className="exchange-inspection-field">
                                            <label>Full Service History</label>
                                            <select
                                                name="fullServiceHistory"
                                                defaultValue={
                                                    inspection?.fullServiceHistory === true
                                                        ? 'true'
                                                        : inspection?.fullServiceHistory === false
                                                            ? 'false'
                                                            : ''
                                                }
                                            >
                                                <option value="">Not verified</option>
                                                <option value="true">Yes</option>
                                                <option value="false">No</option>
                                            </select>
                                        </div>

                                        {/* Accident Severity */}
                                        {accidentHistorySelection === 'true' && (
                                            <div className="exchange-inspection-field">
                                                <label>Accident Severity</label>
                                                <select
                                                    name="accidentSeverity"
                                                    value={accidentSeveritySelection}
                                                    onChange={(event) => setAccidentSeveritySelection(event.target.value)}
                                                    required
                                                >
                                                    <option value="">Select accident severity</option>
                                                    <option value="MINOR">Minor</option>
                                                    <option value="MODERATE">Moderate</option>
                                                    <option value="MAJOR">Major</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* Repaint Coverage */}
                                        {repaintHistorySelection === 'true' && (
                                            <div className="exchange-inspection-field">
                                                <label>Repaint Coverage</label>
                                                <select
                                                    name="repaintCoverage"
                                                    value={repaintCoverageSelection}
                                                    onChange={(event) => setRepaintCoverageSelection(event.target.value)}
                                                    required
                                                >
                                                    <option value="">Select repaint coverage</option>
                                                    <option value="ONE_TO_TWO_PANELS">1–2 Panels</option>
                                                    <option value="THREE_TO_FIVE_PANELS">3–5 Panels</option>
                                                    <option value="FULL_BODY">Full Body</option>
                                                </select>
                                            </div>
                                        )}

                                        <div className="exchange-inspection-field">
                                            <label>Inspection Notes</label>
                                            <textarea
                                                name="notes"
                                                rows={3}
                                                maxLength={1000}
                                                defaultValue={inspection?.notes || ''}
                                                placeholder="Enter vehicle inspection observations..."
                                            />
                                        </div>

                                        <button type="submit" disabled={savingInspection}>
                                            {savingInspection ? 'Saving...' : 'Save Inspection'}
                                        </button>
                                    </form>
                                )}

                                {inspectionMessage && (
                                    <p className="exchange-inspection-message">{inspectionMessage}</p>
                                )}
                            </section>

                            <div className="rc-document-upload">
                                <label>
                                    RC Book Front
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setRcFrontFile(e.target.files?.[0] ?? null)
                                        }
                                    />
                                </label>

                                <label>
                                    RC Book Back
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setRcBackFile(e.target.files?.[0] ?? null)
                                        }
                                    />
                                </label>

                                <button
                                    type="button"
                                    disabled={uploadingRcBook || (!rcFrontFile && !rcBackFile)}
                                    onClick={async () => {
                                        let frontUploaded = false;
                                        let backUploaded = false;

                                        if (rcFrontFile) {
                                            frontUploaded = await uploadRcDocument(
                                                rcFrontFile,
                                                'RC_BOOK_FRONT'
                                            );
                                        }

                                        if (rcBackFile) {
                                            backUploaded = await uploadRcDocument(
                                                rcBackFile,
                                                'RC_BOOK_BACK'
                                            );
                                        }

                                        if (frontUploaded && backUploaded) {
                                            setRcUploadMessage('Front and Back RC Books uploaded successfully.');
                                        } else if (frontUploaded) {
                                            setRcUploadMessage('Front RC Book uploaded successfully.');
                                        } else if (backUploaded) {
                                            setRcUploadMessage('Back RC Book uploaded successfully.');
                                        }

                                        if (frontUploaded || backUploaded) {
                                            setRcFrontFile(null);
                                            setRcBackFile(null);
                                        }
                                    }}
                                >
                                    {uploadingRcBook ? 'Uploading...' : 'Upload RC Documents'}
                                </button>

                                {rcUploadMessage && <p>{rcUploadMessage}</p>}
                            </div>

                            <div className="exchange-uploaded-documents">
                                <h4>Uploaded RC Documents</h4>

                                {loadingDocuments ? (
                                    <p>Loading documents...</p>
                                ) : vehicleDocuments.length === 0 ? (
                                    <p>No RC documents uploaded yet.</p>
                                ) : (
                                    vehicleDocuments.map((document) => (
                                        <div className="exchange-document-item" key={document.id}>
                                            <div>
                                                <strong>
                                                    {document.documentType === 'RC_BOOK_FRONT'
                                                        ? 'RC Book Front'
                                                        : 'RC Book Back'}
                                                </strong>
                                                <span>{document.originalName}</span>
                                            </div>

                                            <a
                                                href={`http://localhost:3000/api/exchange-vehicles/${document.vehicleId}/documents/${document.id}/file`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Download
                                            </a>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                type="button"
                                className="exchange-scan-button"
                                onClick={scanRcBook}
                            >
                                🔍 Scan RC Book
                            </button>

                            {verificationResult && (
                                <p className="exchange-demo-note">
                                    Verification assessment available. Review the
                                    risk findings and document details before recording
                                    the final verification decision.
                                </p>
                            )}
                        </div>
                    </aside>
                </div >
            )
            }

            {
                showIntakeForm && (
                    <div
                        className="exchange-drawer-overlay"
                        onClick={() => setShowIntakeForm(false)}
                    >
                        <section
                            className="exchange-intake-modal"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="exchange-drawer-header">
                                <h2>New Exchange Intake</h2>

                                <button
                                    type="button"
                                    className="exchange-drawer-close"
                                    onClick={() => setShowIntakeForm(false)}
                                    aria-label="Close intake form"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Intake Form */}
                            <form
                                className="exchange-intake-form"
                                onSubmit={handleIntakeSubmit}
                            >
                                <div className="exchange-intake-fields">

                                    {/* Section 1: Customer and Branch */}
                                    <div className="exchange-intake-section">
                                        <h3>Customer & Branch Details</h3>
                                        <p>Identify the customer and receiving dealership branch.</p>
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-customer">Customer Name *</label>
                                        <input
                                            id="intake-customer"
                                            name="customerName"
                                            type="text"
                                            placeholder="Enter customer name"
                                            required
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-branch">Branch *</label>
                                        <select
                                            id="intake-branch"
                                            name="branchId"
                                            required
                                            defaultValue=""
                                            disabled={loadingBranches || activeBranches.length === 0}
                                        >
                                            <option value="" disabled>
                                                {loadingBranches ? 'Loading branches...' : 'Select branch'}
                                            </option>
                                            {activeBranches.map((branch) => (
                                                <option key={branch.id} value={branch.id}>
                                                    {branch.name} ({branch.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Section 2: Vehicle Information */}
                                    <div className="exchange-intake-section">
                                        <h3>Vehicle Information</h3>
                                        <p>Enter the vehicle details required for inspection and valuation.</p>
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-make">Make *</label>
                                        <input
                                            id="intake-make"
                                            name="make"
                                            type="text"
                                            placeholder="e.g. Mahindra"
                                            required
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-model">Model *</label>
                                        <input
                                            id="intake-model"
                                            name="model"
                                            type="text"
                                            placeholder="e.g. Mahindra"
                                            required
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-variant">Variant</label>
                                        <input
                                            id="intake-variant"
                                            name="variant"
                                            type="text"
                                            placeholder="e.g. MX2"
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-year">Model Year *</label>
                                        <input
                                            id="intake-year"
                                            name="modelYear"
                                            type="number"
                                            min="1900"
                                            max={new Date().getFullYear() + 1}
                                            placeholder="e.g. 2020"
                                            required
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-fuel-type">Fuel Type *</label>
                                        <select
                                            id="intake-fuel-type"
                                            name="fuelType"
                                            required
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select fuel type</option>
                                            <option value="PETROL">Petrol</option>
                                            <option value="DIESEL">Diesel</option>
                                            <option value="CNG">CNG</option>
                                            <option value="EV">Electric (EV)</option>
                                        </select>
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-vehicle-segment">Vehicle Segment *</label>
                                        <select
                                            id="intake-vehicle-segment"
                                            name="vehicleSegment"
                                            required
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select vehicle segment</option>
                                            <option value="PASSENGER">Passenger</option>
                                            <option value="COMMERCIAL">Commercial</option>
                                            <option value="THREE_WHEELER">Three Wheeler</option>
                                        </select>
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-odometer">Odometer (km) *</label>
                                        <input
                                            id="intake-odometer"
                                            name="odometerKm"
                                            type="number"
                                            min="0"
                                            placeholder="Enter kilometres"
                                            required
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-owners">Previous Owner Count</label>
                                        <input
                                            id="intake-owners"
                                            name="previousOwnerCount"
                                            type="number"
                                            min="0"
                                            placeholder="Enter owner count"
                                        />
                                    </div>

                                    {/* Section 3: Registration Details */}
                                    <div className="exchange-intake-section">
                                        <h3>Registration Details</h3>
                                        <p>Provide registration information for vehicle identification and RC verification.</p>
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-registration">Registration Number</label>
                                        <input
                                            id="intake-registration"
                                            name="registrationNumber"
                                            type="text"
                                            placeholder="e.g. MH12AB1234"
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-chassis">Chassis Number</label>
                                        <input
                                            id="intake-chassis"
                                            name="chassisNumber"
                                            type="text"
                                            placeholder="Enter chassis number"
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-engine">Engine Number</label>
                                        <input
                                            id="intake-engine"
                                            name="engineNumber"
                                            type="text"
                                            placeholder="Enter engine number"
                                        />
                                    </div>

                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-registration-date">Registration Date</label>
                                        <input
                                            id="intake-registration-date"
                                            name="registrationDate"
                                            type="date"
                                        />
                                    </div>
                                    <div className="exchange-intake-field">
                                        <label htmlFor="intake-colour">Vehicle Colour *</label>
                                        <input
                                            id="intake-colour"
                                            name="colour"
                                            type="text"
                                            placeholder="e.g. Silver, White, Black"
                                            required
                                        />
                                    </div>

                                </div>

                                {intakeError && (
                                    <p role="alert" className="exchange-scan-message">
                                        {intakeError}
                                    </p>
                                )}

                                {/* Footer Buttons */}
                                <div className="exchange-intake-footer">
                                    <button
                                        type="button"
                                        className="exchange-intake-cancel"
                                        onClick={() => setShowIntakeForm(false)}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="exchange-intake-submit"
                                        disabled={submittingIntake || loadingBranches || activeBranches.length === 0}
                                    >
                                        {submittingIntake ? 'Creating Intake...' : 'Start Intake'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )
            }
        </div >
    );
}

export default ExchangeVehicles;
