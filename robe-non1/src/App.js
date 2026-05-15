
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, deleteDoc, doc, updateDoc,
  getDoc, setDoc, arrayUnion, getDocs, deleteField, where
} from 'firebase/firestore';

// Lucide React for icons

import { 
  ClipboardList, UserRound, ArrowUp, MessageSquare, Plus, ChevronLeft, ChevronRight, 
  Trash2, Copy, Phone, Undo2, History, AlertTriangle, Edit, Lock, Search, 
  ChevronDown, ChevronUp, Calendar, Settings, X, BookOpen, BarChart2, TrendingUp, 
  TrendingDown, Minus, Trophy, RefreshCcw, User, MousePointer2, FileText, Download, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, Maximize2, LayoutDashboard, ArrowRight, 
  Smartphone, XCircle 
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDIC0be4A6AK3lDjH5ouh_oywGvTKRxMt4",
  authDomain: "robe-non1.firebaseapp.com",
  projectId: "robe-non1",
  storageBucket: "robe-non1.firebasestorage.app",
  messagingSenderId: "491977372291",
  appId: "1:491977372291:web:8abd59846cc674689a61b6"
};
const appId = firebaseConfig.appId;


// --- Main App Component ---
function Dashboard({ user, userRole, db, branches, setBranches }) {
  // --- Integrated CRM State ---
  const [customerRecords, setCustomerRecords] = useState([]); // Unified records
  const [newCustomerForm, setNewCustomerForm] = useState({
    branch: '도산',
    tmPerson: '', // TM reservation
    salesperson: '', // Field salesperson (Unified)
    customerName: '',
    customerContact: '',
    source: '인스타그램', // Default source
    status: '대기', // Default status: Pending
    reservationDate: new Date().toISOString().split('T')[0],
    reservationTime: '14:00',
    consultationTime: '',
    memo: '',
    // Phase 3: New Fields
    contractAmount: '', // Deposit / Initial
    finalContractAmount: '', // Total for ranking
    consultationContent: '', // Details
    dbCreator: '', // DB Entry Person
    reason: '', // Only for uncontracted
    isImmediateConsult: false, // Legacy toggle
    mode: 'pending', // NEW: 'pending', 'contracted', 'uncontracted', 'noshow'
    isSameAsConsultant: true, // NEW: checkbox for DB creator
    isRecontracted: false // NEW: for recontracted status
  });
  const [salespersonSearch, setSalespersonSearch] = useState(''); // NEW: For Dashboard Search

  // Duplicate Check State
  const [duplicateLeads, setDuplicateLeads] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Performance Analysis Modal State
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState(null);

  // --- Legacy/UI State ---
  const [activeTab, setActiveTab] = useState('contract_dashboard'); // 'contract_dashboard', 'registration_consultation', 'db_list'
  const [isWaitingListExpanded, setIsWaitingListExpanded] = useState(true); // Toggle for waiting list

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const topOfPageRef = useRef(null);
  const formRef = useRef(null);
  const reportRef = useRef(null);


  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState(null);

  // Phase 3: Consultation Modal State
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [selectedConsultationRecord, setSelectedConsultationRecord] = useState(null);

  // -- Save Success States --
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [saveSuccessResult, setSaveSuccessResult] = useState(null);
  const [showRecontractModal, setShowRecontractModal] = useState(false);
  const [recontractRecord, setRecontractRecord] = useState(null);
  const [recontractForm, setRecontractForm] = useState({ salesperson: '', content: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showRevertConfirmModal, setShowRevertConfirmModal] = useState(false);
  const [recordToRevert, setRecordToRevert] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingLogText, setEditingLogText] = useState('');

  const [unclosedPage, setUnclosedPage] = useState(1);
  const [recontactedPage, setRecontactedPage] = useState(1);
  const [recontractedCompletedPage, setRecontractedCompletedPage] = useState(1);
  const recordsPerPage = 5;

  const [statsMonth, setStatsMonth] = useState(new Date());
  const [lureWeekOffset, setLureWeekOffset] = useState(0);
  const [totalWeekOffset, setTotalWeekOffset] = useState(0);
  const [lureMonthOffset, setLureMonthOffset] = useState(0);
  const [totalMonthOffset, setTotalMonthOffset] = useState(0);
  const [dashboardListFilter, setDashboardListFilter] = useState(null); // { type, period, status, label }
  const [zoomedSegment, setZoomedSegment] = useState(null); // 'lureMonth', 'lureWeek', 'totalMonth', 'totalWeek'
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadReport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Small delay to ensure the template is rendered if it was conditionally shown
      // but here we keep it in the DOM (off-screen)
      const element = reportRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const fileName = `${statsMonth.getFullYear()}년_${statsMonth.getMonth() + 1}월_성과보고서.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Report generation failed:', err);
      alert('보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDetailReport = async (element) => {
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Detail_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      alert('출력 중 오류가 발생했습니다.');
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', '계약', '미계약', '노쇼'

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingList, setEditingList] = useState({ name: '', title: '', items: [] });
  const [newItemText, setNewItemText] = useState('');

  const [sources, setSources] = useState(['워크인', '박람회', '루어', '지인소개', '크라우드', '기타']);
  const [reasons, setReasons] = useState(['가격 문제', '비교 방문', '고객 변심', '의견 불일치', '기타', '노쇼']);

  // -- Separate state for Header Dropdown vs Actual Modal --
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);


  const baseBranchColors = {
    '도산': '#EF4444', '광교': '#F97316', '구월': '#F59E0B', '노원': '#10B981', '대전': '#6B7280',
    '부산': '#3B82F6', '성수': '#A855F7', '수원': '#EC4899', '압구정': '#14B8A6', '인천': '#6366F1',
    '잠실': '#84CC16', '기타': '#78716C'
  };

  // Calculate dynamic colors if branches change
  const branchColors = useMemo(() => {
    const colors = { ...baseBranchColors, '신사': baseBranchColors['도산'] };
    const palette = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];
    branches.forEach((b, idx) => {
      if (!colors[b]) {
        colors[b] = palette[idx % palette.length];
      }
    });
    return colors;
  }, [branches]);



  // useEffects for db and settings moved to App component

  // --- Fetch Data (Integrated) ---
  useEffect(() => {
    if (!db || !user) return;
    setLoading(true);
    const q = query(collection(db, `artifacts/${appId}/public/data/customer_records`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date desc
      fetchedRecords.sort((a, b) => {
        const dateA = a.reservationDate ? new Date(a.reservationDate) : (a.createdAt ? a.createdAt.toDate() : new Date());
        const dateB = b.reservationDate ? new Date(b.reservationDate) : (b.createdAt ? b.createdAt.toDate() : new Date());
        return dateB - dateA;
      });
      setCustomerRecords(fetchedRecords);
      setLoading(false);
    }, (err) => {
      console.error("Data Fetch Error:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, user]);
  const handleCustomerFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewCustomerForm(prev => {
      let val = type === 'checkbox' ? checked : value;

      // Handle comma formatting for currency fields
      if (name === 'finalContractAmount') {
        val = unformatCommas(value);
      }

      let updated = { ...prev, [name]: val };

      // Auto-sync DB Creator if "Same as Consultant" is checked
      if (updated.isSameAsConsultant && updated.salesperson) {
        updated.dbCreator = updated.salesperson;
      }

      // Duplicate Check Trigger
      if (name === 'customerName' || name === 'customerContact') {
        checkDuplicates(updated.customerName, updated.customerContact);
      }

      return updated;
    });
  };

  const checkDuplicates = (name, contact) => {
    if (!name && !contact) {
      setDuplicateLeads([]);
      setShowDuplicateWarning(false);
      return;
    }

    const matches = customerRecords.filter(r => {
      const nameMatch = name && r.customerName?.toLowerCase().includes(name.toLowerCase());
      const contactMatch = contact && r.customerContact?.replace(/[^0-9]/g, '').includes(contact.replace(/[^0-9]/g, ''));
      return nameMatch || contactMatch;
    });

    setDuplicateLeads(matches.slice(0, 3));
    setShowDuplicateWarning(matches.length > 0);
  };

  const handleUseExisting = (record) => {
    // Stop entry and open consultation modal for existing
    setShowDuplicateWarning(false);
    setSelectedConsultationRecord(record);
    setShowConsultationModal(true);
    // Reset form
    const today = new Date().toISOString().split('T')[0];
    setNewCustomerForm({
      branch: '도산', source: '워킹', customerName: '', customerContact: '', reservationDate: today, reservationTime: '', memo: '',
      salesperson: '', status: '계약', finalContractAmount: '', contractAmount: '', consultationContent: '',
      reason: '', mode: 'pending', isImmediateConsult: false, isProcessingExisting: false, isSameAsConsultant: false, dbCreator: '', tmPerson: ''
    });
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!db || !newCustomerForm.customerName || !newCustomerForm.branch) {
      alert("지점과 고객 이름은 필수입니다.");
      return;
    }

    // Validation for immediate consult (anything other than 'pending')
    if (newCustomerForm.mode !== 'pending' && (!newCustomerForm.salesperson || !newCustomerForm.status)) {
      alert("상담자와 결과를 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const finalStatus = newCustomerForm.mode === 'pending' ? '대기' : newCustomerForm.status;

      // Prepare common record data
      const recordData = {
        branch: newCustomerForm.branch,
        source: newCustomerForm.source,
        customerName: newCustomerForm.customerName,
        customerContact: newCustomerForm.customerContact,
        reservationDate: newCustomerForm.reservationDate,
        reservationTime: newCustomerForm.reservationTime,
        status: finalStatus,
        salesperson: newCustomerForm.salesperson || '',
        dbCreator: newCustomerForm.dbCreator || '',
        tmPerson: newCustomerForm.tmPerson || '',
        // Other fields will be handled separately for add vs update
      };

      if (newCustomerForm.isProcessingExisting && newCustomerForm.existingRecordId) {
        // === UPDATE EXISTING RECORD CASE ===
        const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, newCustomerForm.existingRecordId);
        const recordSnap = await getDoc(recordRef);
        const currentData = recordSnap.data();

        const newLogs = [...(currentData.consultationLogs || [])];
        const consultLogText = newCustomerForm.consultationContent || '';

        // Add log if present
        if (consultLogText) {
          newLogs.push({
            id: Date.now().toString(),
            text: consultLogText,
            type: `${finalStatus} 상담`,
            createdAt: new Date(),
            createdBy: newCustomerForm.salesperson
          });
          recordData.recordContent = consultLogText;
        }

        // Prepare history
        const historyEntry = {
          status: finalStatus,
          timestamp: new Date(),
          note: `상담 처리 완료: ${finalStatus} by ${newCustomerForm.salesperson}`,
          details: consultLogText
        };

        const updatePayload = {
          ...recordData,
          consultationTime: new Date(),
          consultationLogs: newLogs,
          history: arrayUnion(historyEntry),
          finalContractAmount: newCustomerForm.mode === 'contracted' ? (Number(newCustomerForm.finalContractAmount) || 0) : 0,
          reason: newCustomerForm.mode === 'uncontracted' ? newCustomerForm.reason : ''
        };

        await updateDoc(recordRef, updatePayload);
      } else {
        // === NEW DB REGISTRATION CASE ===
        const newRecordData = {
          ...recordData,
          createdAt: new Date(),
          history: [{ status: '대기', timestamp: new Date(), note: '최초 DB 등록' }],
          consultationLogs: []
        };

        // 1. Add initial log if memo exists
        if (newCustomerForm.memo) {
          newRecordData.consultationLogs.push({
            id: Date.now().toString(),
            text: newCustomerForm.memo,
            type: '최초 등록',
            createdAt: new Date(),
            createdBy: newCustomerForm.dbCreator || newCustomerForm.salesperson || 'system'
          });
          newRecordData.recordContent = newCustomerForm.memo;
        }

        // 2. Add immediate result log & history (if not pending)
        if (newCustomerForm.mode !== 'pending') {
          newRecordData.consultationTime = new Date();
          const consultLogText = newCustomerForm.consultationContent || '';

          if (consultLogText) {
            newRecordData.consultationLogs.push({
              id: (Date.now() + 1).toString(),
              text: consultLogText,
              type: `${finalStatus} 상담`,
              createdAt: new Date(),
              createdBy: newCustomerForm.salesperson
            });
            newRecordData.recordContent = consultLogText;
          }

          newRecordData.history.push({
            status: finalStatus,
            timestamp: new Date(),
            note: `직구/현장 상담 등록: ${finalStatus} by ${newCustomerForm.salesperson}`,
            salesperson: newCustomerForm.salesperson,
            details: consultLogText
          });

          if (newCustomerForm.finalContractAmount) {
            newRecordData.finalContractAmount = Number(newCustomerForm.finalContractAmount);
          }
          if (newCustomerForm.reason) {
            newRecordData.reason = newCustomerForm.reason;
          }
        }

        await addDoc(collection(db, `artifacts/${appId}/public/data/customer_records`), newRecordData);
      }

      setNewCustomerForm(prev => ({
        ...prev,
        customerName: '', customerContact: '', reservationDate: new Date().toISOString().split('T')[0], reservationTime: '14:00', memo: '',
        salesperson: '', status: '대기', finalContractAmount: '', contractAmount: '', consultationContent: '', reason: '',
        mode: 'pending', isImmediateConsult: false, isRecontracted: false,
        isProcessingExisting: false, existingRecordId: null
      }));
      setDuplicateLeads([]);
      setShowDuplicateWarning(false);
      setError(null);

      // Show summary for anything other than 'pending' registration
      if (newCustomerForm.mode !== 'pending') {
        const summaryData = {
          branch: newCustomerForm.branch,
          status: finalStatus,
          customerName: newCustomerForm.customerName,
          source: newCustomerForm.source,
          reservationDate: newCustomerForm.reservationDate,
          finalContractAmount: newCustomerForm.finalContractAmount,
          contractAmount: newCustomerForm.contractAmount,
          consultationContent: newCustomerForm.consultationContent
        };
        setSaveSuccessResult(summaryData);
        setShowSaveSuccessModal(true);
      } else {
        alert('신규 DB가 대기 리스트에 등록되었습니다.');
      }

      if (topOfPageRef.current) topOfPageRef.current.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      setError("데이터 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWaitingCustomer = (record) => {
    setNewCustomerForm(prev => ({
      ...prev,
      existingRecordId: record.id,
      isProcessingExisting: true,
      customerName: record.customerName || '',
      customerContact: record.customerContact || '',
      branch: record.branch || '도산',
      source: record.source || '인스타그램',
      reservationDate: record.reservationDate || '',
      reservationTime: record.reservationTime || '',
      memo: record.memo || record.recordContent || '',
      mode: 'contracted', // Default to result entry mode
      isImmediateConsult: true,
      status: '계약',
      salesperson: '' // Reset salesperson for fresh input
    }));

    // Scroll to form with visual clue
    setTimeout(() => {
      const formElement = document.getElementById('consultation-form-section');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCancelSelection = () => {
    setNewCustomerForm(prev => ({
      ...prev,
      isProcessingExisting: false,
      existingRecordId: null,
      customerName: '',
      customerContact: '',
      memo: '',
      mode: 'pending',
      status: '대기'
    }));
  };

  const handleRecontractFormChange = (e) => setRecontractForm(prev => ({ ...prev, [e.target.name]: e.target.value }));




  const handleUpdateList = async (listName, updatedItems) => {
    if (!db) return;
    const docRef = doc(db, `artifacts/${appId}/public/data/dashboard_settings`, listName);
    try {
      await setDoc(docRef, { items: updatedItems });
    } catch (e) {
      setError(`${editingList.title} 목록 업데이트 중 오류 발생`);
    }
  };

  const handleAddItemToList = async () => {
    if (!newItemText.trim() || !editingList.name) return;
    const docRef = doc(db, `artifacts/${appId}/public/data/dashboard_settings`, editingList.name);
    const newItems = [...editingList.items, newItemText.trim()];
    await setDoc(docRef, { items: newItems }, { merge: true });
    setEditingList(prev => ({ ...prev, items: newItems }));
    setNewItemText('');
  };

  const handleDeleteItemFromList = async (item) => {
    if (!editingList.name) return;
    const docRef = doc(db, `artifacts/${appId}/public/data/dashboard_settings`, editingList.name);
    const newItems = editingList.items.filter(i => i !== item);
    await setDoc(docRef, { items: newItems }, { merge: true });
    setEditingList(prev => ({ ...prev, items: newItems }));
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      // Calculate position to scroll to:
      // Element's top position - Header Height (approx 80px) - Extra Buffer (20px)
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const handleShortcut = (type) => {
    setShowSettingsDropdown(false);
    setActiveTab('input');

    // Preset source if Lure shortcut is clicked
    if (type === 'lure') {
      setNewCustomerForm(prev => ({ ...prev, source: '루어' }));
    } else {
      // Optional: Reset to default for other shortcuts? Or keep current selection?
      // Let's reset to default '워크인' if user clicks 'Uncontracted' shortcut to distinct it.
      setNewCustomerForm(prev => ({ ...prev, source: '워크인' }));
    }

    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const openSettingsModal = (name, title, items) => {
    setEditingList({ name, title, items });
    setShowSettingsDropdown(false); // Close dropdown
    setShowSettingsModal(true); // Open Modal
  };

  const openRevertConfirmModal = (record) => {
    setRecordToRevert(record);
    setShowRevertConfirmModal(true);
  };

  const handleRevertToUnclosed = async () => {
    if (!db || !recordToRevert) return;
    try {
      const originalComments = recordToRevert.comments.filter(c => {
        const type = typeof c === 'object' ? c.type : 'original';
        return type === 'original';
      });
      await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, recordToRevert.id), {
        status: '미계약',
        comments: originalComments,
      });
      setShowRevertConfirmModal(false);
      setRecordToRevert(null);
    } catch (e) {
      setError("재계약 기록 저장 중 오류가 발생했습니다.");
    }
  };

  // Phase 3: Save Consultation Logic
  const handleSaveConsultation = async (recordId, data) => {
    try {
      const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, recordId);
      const recordSnap = await getDoc(recordRef);
      const currentData = recordSnap.data();

      // 1. Prepare logs
      const newLogs = [...(currentData.consultationLogs || [])];

      // 상담자 변경 이력 체크
      if (data.salesperson && currentData.salesperson !== data.salesperson) {
        newLogs.push({
          id: `sp-${Date.now()}`,
          text: `상담자가 변경되었습니다: ${currentData.salesperson || '미지정'} -> ${data.salesperson}`,
          type: '상담자 변경',
          createdAt: new Date(),
          createdBy: 'System'
        });
      }

      const consultLogText = data.consultationContent || data.memo || '';
      if (consultLogText) {
        newLogs.push({
          id: Date.now().toString(),
          text: consultLogText,
          type: `${data.status} 상담`,
          createdAt: new Date(),
          createdBy: data.salesperson || 'Unknown'
        });
      }

      // 2. Prepare update data
      const updateData = {
        status: data.status,
        salesperson: data.salesperson,
        customerName: data.customerName,
        customerContact: data.customerContact,
        reservationDate: data.reservationDate,
        reservationTime: data.reservationTime,
        contractAmount: data.contractAmount,
        finalContractAmount: data.finalContractAmount ? Number(data.finalContractAmount) : 0,
        reason: data.reason,
        consultationTime: new Date(),
        consultationLogs: newLogs,
        recordContent: consultLogText || currentData.recordContent || '' // for preview
      };

      // 3. Add history entry
      const historyEntry = {
        status: data.status,
        timestamp: new Date(),
        note: `상담 완료: ${data.status} by ${data.salesperson || 'Unknown'}`,
        details: consultLogText
      };

      await updateDoc(recordRef, {
        ...updateData,
        history: arrayUnion(historyEntry),
        memo: deleteField(),
        consultationContent: deleteField()
      });

      setShowConsultationModal(false);
      setSelectedConsultationRecord(null);

      // Prepare data for summary modal
      const summaryData = {
        branch: currentData.branch || '정보없음',
        status: data.status,
        customerName: currentData.customerName || '정보없음',
        source: currentData.source || '정보없음',
        reservationDate: currentData.reservationDate || '',
        finalContractAmount: data.finalContractAmount,
        contractAmount: data.contractAmount,
        consultationContent: data.consultationContent
      };
      setSaveSuccessResult(summaryData);
      setShowSaveSuccessModal(true);
    } catch (e) {
      console.error("Error saving consultation:", e);
      setError("상담 결과 저장 중 오류가 발생했습니다.");
    }
  };

  const openRecontractModal = (record) => {
    setRecontractRecord(record);
    setRecontractForm({ salesperson: '', content: '' });
    setShowRecontractModal(true);
  };

  const handleConfirmRecontract = async (e) => {
    e.preventDefault();
    if (!db || !recontractRecord || !recontractForm.salesperson || !recontractForm.content) {
      return setError("재계약 상담자와 과정 기록을 모두 입력해주세요.");
    }
    try {
      const recontractNote = {
        text: `[재계약 성공]상담자: ${recontractForm.salesperson} \n과정: ${recontractForm.content} `,
        type: 'recontract-process',
        timestamp: new Date()
      };
      const updatedComments = [...(recontractRecord.comments || []), recontractNote];
      await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, recontractRecord.id), {
        status: '계약',
        isRecovery: true,
        consultationTime: new Date(),
        salesperson: recontractForm.salesperson, // Sync salesperson
        comments: updatedComments,
      });
      setShowRecontractModal(false);
      setRecontractRecord(null);
      setError(null);
    } catch (e) { setError("재계약 처리 중 오류가 발생했습니다."); }
  };

  const handleAddComment = async () => {
    const activeRecord = selectedConsultationRecord || selectedRecord;
    if (!db || !activeRecord?.id || !newCommentText) return;
    try {
      const newCommentObject = {
        text: newCommentText,
        type: activeRecord.status === 'recontracted' ? 'follow-up' : 'original',
        timestamp: new Date()
      };
      const updatedComments = [...(activeRecord.comments || []), newCommentObject];
      await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, activeRecord.id), { comments: updatedComments });
      setNewCommentText('');
      if (selectedConsultationRecord) {
        setSelectedConsultationRecord(prev => ({ ...prev, comments: updatedComments }));
      } else {
        setSelectedRecord(prev => ({ ...prev, comments: updatedComments }));
      }
    } catch (e) { setError("코멘트 추가 중 오류가 발생했습니다."); }
  };

  const handleDeleteComment = async (commentIndexToDelete, commentType) => {
    const activeRecord = selectedConsultationRecord || selectedRecord;
    if (!db || !activeRecord?.id) return;
    try {
      const commentsOfType = activeRecord.comments.filter(c => (typeof c === 'object' ? c.type === commentType : (commentType === 'original' && !c.startsWith('[재계약 성공]'))));
      const otherComments = activeRecord.comments.filter(c => (typeof c === 'object' ? c.type !== commentType : (commentType === 'original' && c.startsWith('[재계약 성공]'))));

      const updatedCommentsOfType = commentsOfType.filter((_, index) => index !== commentIndexToDelete);

      const finalComments = [...otherComments, ...updatedCommentsOfType];

      await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, activeRecord.id), { comments: finalComments });
      if (selectedConsultationRecord && selectedConsultationRecord.id === activeRecord.id) {
        setSelectedConsultationRecord(prev => ({ ...prev, comments: finalComments }));
      } else if (selectedRecord && selectedRecord.id === activeRecord.id) {
        setSelectedRecord(prev => ({ ...prev, comments: finalComments }));
      }
    } catch (e) { setError("코멘트 삭제 중 오류가 발생했습니다."); }
  };

  const handleDeleteRecord = async () => {
    if (!db || !deleteRecordId) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, deleteRecordId));
      setDeleteRecordId(null);
      setShowConfirmDeleteModal(false);
    } catch (e) { setError("데이터 삭제 중 오류가 발생했습니다."); }
  };

  const toggleRecontact = async (recordId, currentStatus) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, recordId), { recontacted: !currentStatus });
    } catch (e) { setError("리컨택 상태 업데이트 중 오류가 발생했습니다."); }
  };

  const handleCleanupData = async () => {
    if (!db || !window.confirm("기존 데이터 필드(상담자 단일화 및 재계약 결과 보정)를 정리하시겠습니까?")) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));
      let cleanupCount = 0;

      for (const d of snapshot.docs) {
        const data = d.data();
        let updates = {};

        // 1. Unify everything to 'salesperson' (Legacy First)
        if (data.consultant) {
          updates.salesperson = data.consultant;
          updates.consultant = deleteField(); // Remove redundant field
        }

        // 2. Set dbCreator for legacy
        if (!data.dbCreator) {
          updates.dbCreator = data.salesperson || '기존 데이터';
        }

        // 3. Unify recontracted status to '계약' with recovery flag
        if (data.status === 'recontracted') {
          updates.status = '계약';
          updates.isRecovery = true;
        } else if (data.status === '계약' && data.migratedFrom === 'unclosed_records') {
          // All contracts from legacy DB are recoveries
          updates.isRecovery = true;
        }

        // 4. Cleanup old history statuses if needed
        if (data.history) {
          const cleanedHistory = data.history.map(h => ({
            ...h,
            status: h.status === 'recontracted' ? '계약' : h.status
          }));
          updates.history = cleanedHistory;
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, `artifacts/${appId}/public/data/customer_records`, d.id), updates);
          cleanupCount++;
        }
      }
      alert(`데이터 정리 완료! 총 ${cleanupCount}건의 데이터 보정되었습니다.`);
    } catch (e) {
      console.error(e);
      alert("데이터 정리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditLog = (logId, text) => {
    setEditingLogId(logId);
    setEditingLogText(text);
  };

  const handleUpdateLog = async (recordId) => {
    if (!db || !editingLogId) return;
    try {
      const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, recordId);
      const recordSnap = await getDoc(recordRef);
      const currentData = recordSnap.data();

      const updatedLogs = (currentData.consultationLogs || []).map(log =>
        log.id === editingLogId ? { ...log, text: editingLogText } : log
      );

      await updateDoc(recordRef, {
        consultationLogs: updatedLogs,
        recordContent: updatedLogs[updatedLogs.length - 1]?.text || currentData.recordContent
      });

      setEditingLogId(null);
      setEditingLogText('');
      setSelectedRecord(prev => ({ ...prev, consultationLogs: updatedLogs }));
    } catch (e) {
      console.error(e);
      alert("기록 수정 중 오류가 발생했습니다.");
    }
  };

  const handleMigrateData = async () => {
    if (!db || !window.confirm("과거 미계약(unclosed_records) 데이터를 통합(customer_records)으로 이전하시겠습니까? 중복 데이터는 제외됩니다.")) return;
    setLoading(true);
    try {
      const legacyRef = collection(db, `artifacts/${appId}/public/data/unclosed_records`);
      const snapshot = await getDocs(query(legacyRef));
      const legacyRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let migratedCount = 0;
      let skippedCount = 0;

      for (const record of legacyRecords) {
        const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, record.id);
        const checkDoc = await getDoc(recordRef);
        if (!checkDoc.exists()) {
          await setDoc(recordRef, {
            ...record,
            status: record.status === 'recontracted' ? '계약' : (record.status || '미계약'),
            isRecovery: record.status === 'recontracted',
            salesperson: record.salesperson || '', // Legacy standard
            migratedFrom: 'unclosed_records',
            migratedAt: new Date()
          });
          migratedCount++;
        } else {
          skippedCount++;
        }
      }

      alert(`이전 완료! \n- 이전됨: ${migratedCount}건\n- 스킵(이미 존재): ${skippedCount}건`);
    } catch (e) {
      console.error("Migration error:", e);
      alert("데이터 이전 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const openCommentModal = (record) => { setShowHistory(false); setSelectedRecord(record); setShowCommentModal(true); };
  const openConfirmDeleteModal = (recordId) => { setDeleteRecordId(recordId); setShowConfirmDeleteModal(true); };

  const handleCopyRecord = () => {
    if (!selectedRecord) return;
    let copyText = `[기본 정보]\n지점: ${selectedRecord.branch} \n최초 상담자: ${selectedRecord.salesperson} \n고객: ${selectedRecord.customerName} (${selectedRecord.customerContact || '없음'}) \n출처: ${selectedRecord.source} \n최초 미계약 사유: ${selectedRecord.reason} `;
    if (selectedRecord.status === 'recontracted') {
      const { process } = parseRecontractInfo(selectedRecord);
      if (process) copyText += `\n\n[재계약 과정 기록]\n${process} `;
    } else {
      copyText += `\n\n[미계약 기록]\n${selectedRecord.recordContent} `;
    }
    const textarea = document.createElement('textarea');
    textarea.value = copyText;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('기록 내용이 클립보드에 복사되었습니다.');
    } catch (err) {
      alert('복사에 실패했습니다.');
    }
    document.body.removeChild(textarea);
  };

  const parseRecontractInfo = (record) => {
    const recontractComment = record.comments?.find(c => (typeof c === 'object' && c.type === 'recontract-process') || (typeof c === 'string' && c.startsWith('[재계약 성공]')));
    if (!recontractComment) return { recontractor: 'N/A', process: '' };
    const text = typeof recontractComment === 'string' ? recontractComment : recontractComment.text;
    const lines = text.split('\n');
    const recontractor = lines[0]?.replace('[재계약 성공] 상담자: ', '').trim() || 'N/A';
    const process = lines.slice(1).join('\n').replace('과정: ', '').trim();
    return { recontractor, process };
  };

  const getCommentCount = (record) => {
    if (!record || !record.comments) return 0;
    return record.comments.filter(c => (typeof c === 'object' ? c.type !== 'recontract-process' : !c.startsWith('[재계약 성공]'))).length;
  }

  const filteredAndSortedRecords = useMemo(() => {
    let processedRecords = [...customerRecords];

    // Filter by Active Tab & Status
    if (activeTab === 'registration_consultation') {
      // Work Center only shows 'Waiting' records for the employee to process
      processedRecords = processedRecords.filter(r => r.status === '대기');
    } else if (activeTab === 'db_list') {
      // Archive shows records based on the sub-tab statusFilter
      if (statusFilter === 'contracted') processedRecords = processedRecords.filter(r => r.status === '계약');
      else if (statusFilter === 'uncontracted') processedRecords = processedRecords.filter(r => r.status === '미계약');
      else if (statusFilter === 'noshow') processedRecords = processedRecords.filter(r => r.status === '노쇼' || r.status === '미방문');
      // 'all' shows everything
    }

    // Additional Filters
    if (sourceFilter !== 'all') {
      processedRecords = processedRecords.filter(r => r.source === sourceFilter);
    }
    if (reasonFilter !== 'all') {
      processedRecords = processedRecords.filter(r => r.reason === reasonFilter);
    }

    if (searchTerm) {
      processedRecords = processedRecords.filter(record =>
        record.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.customerContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.salesperson?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    processedRecords.sort((a, b) => {
      // Use reservationDate or createdAt
      const getDate = (r) => r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : new Date());
      const dateA = getDate(a);
      const dateB = getDate(b);
      if (sortBy === 'date-asc') return dateA - dateB;
      return dateB - dateA;
    });

    return processedRecords;
  }, [customerRecords, searchTerm, sortBy, reasonFilter, sourceFilter, activeTab, statusFilter]);

  // Derived Lists for specific legacy views (or new views)
  const allUnclosedRecords = customerRecords.filter(r => r.status === '미계약' && !r.recontacted);


  const dashboardData = useMemo(() => {
    const now = new Date();

    // Stats Base: ALL records
    const allRecords = customerRecords;

    // Calculate Monthly Data (Total DB input)
    const monthlyData = {};
    allRecords.forEach(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      if (!d) return;
      const mKey = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} `;
      monthlyData[mKey] = { total: (monthlyData[mKey]?.total || 0) + 1 };
    });


    // Stats for CURRENT selected month (statsMonth)
    const statsMonthRecords = allRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      return d && d.getFullYear() === statsMonth.getFullYear() && d.getMonth() === statsMonth.getMonth();
    });

    const monthlySalespersons = {};
    const monthlyBranches = {};
    const monthlySources = {};
    const monthlyReasons = {}; // For uncontracted reasons
    const monthlyNoShowsByBranch = {};

    statsMonthRecords.forEach(r => {
      if (r.reason !== '노쇼') {
        monthlySalespersons[r.salesperson] = (monthlySalespersons[r.salesperson] || 0) + 1;
        monthlyBranches[r.branch] = (monthlyBranches[r.branch] || 0) + 1;
        monthlySources[r.source] = (monthlySources[r.source] || 0) + 1;
        monthlyReasons[r.reason] = (monthlyReasons[r.reason] || 0) + 1;
      }

      if (r.reason === '노쇼') {
        monthlyNoShowsByBranch[r.branch] = (monthlyNoShowsByBranch[r.branch] || 0) + 1;
      }
    });

    // --- Unclosed Stats (Status === '미계약') ---
    const unclosedRecords = allRecords.filter(r => r.status === '미계약');

    // Current Month Unclosed
    const currentMonthRecordsCount = unclosedRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      if (!d) return false;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    // Last Month Unclosed
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const lastMonthRecordsCount = unclosedRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      if (!d) return false;
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length;

    // --- Comparisons (3 Months) for Unclosed ---
    const getStatsForMonth = (dateObj) => {
      const targetRecords = unclosedRecords.filter(r => {
        const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
        return d && d.getFullYear() === dateObj.getFullYear() && d.getMonth() === dateObj.getMonth();
      });
      const sp = {};
      const br = {};
      targetRecords.forEach(r => {
        sp[r.salesperson] = (sp[r.salesperson] || 0) + 1;
        br[r.branch] = (br[r.branch] || 0) + 1;
      });
      return { sp, br };
    };

    // Prev Month
    const prevStatsMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - 1, 1);
    const prevStats = getStatsForMonth(prevStatsMonth);

    // Two Months Ago
    const twoMonthsAgoStatsMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - 2, 1);
    const twoAgoStats = getStatsForMonth(twoMonthsAgoStatsMonth);


    // --- Phase 3 Advanced: Core Monthly Stats & Trends ---
    const monthTrend = [];
    const totalDBStats = { total: 0, contracted: 0, uncontracted: 0, noshow: 0 };
    const lureStats = { total: 0, contracted: 0, uncontracted: 0, noshow: 0 };
    const lureMonthlyStats = {};

    // Generate last 6 months list for trend
    for (let i = 5; i >= 0; i--) {
      const d = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthTrend.push({ month: mKey, total: 0 });
    }

    const getFilteredStats = (offset, periodType, isLureOnly = false) => {
      const now = new Date();
      let start, end;

      if (periodType === 'week') {
        const currentBatch = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (offset * 7));
        const day = currentBatch.getDay() || 7;
        start = new Date(currentBatch.getFullYear(), currentBatch.getMonth(), currentBatch.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else {
        start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
      }

      const filtered = allRecords.filter(r => {
        const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
        if (!d) return false;
        const matchesDate = d >= start && d <= end;
        if (!matchesDate) return false;
        if (isLureOnly) return r.source === '루어';
        return true;
      });

      const stats = { total: 0, contracted: 0, uncontracted: 0, noshow: 0, label: '', records: filtered };
      filtered.forEach(r => {
        stats.total++;
        if (r.status === '계약') stats.contracted++;
        else if (r.status === '미계약') stats.uncontracted++;
        else if (r.status === '노쇼' || r.status === '미방문') stats.noshow++;
      });

      stats.contractedPct = stats.total > 0 ? ((stats.contracted / stats.total) * 100).toFixed(1) : 0;
      stats.uncontractedPct = stats.total > 0 ? ((stats.uncontracted / stats.total) * 100).toFixed(1) : 0;
      stats.noshowPct = stats.total > 0 ? ((stats.noshow / stats.total) * 100).toFixed(1) : 0;

      if (periodType === 'week') {
        const weekNum = Math.floor((start.getDate() + 6) / 7);
        stats.label = `${start.getMonth() + 1}월 ${weekNum}주차`;
      } else {
        stats.label = `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
      }
      stats.isFuture = start > now;
      stats.isNow = start <= now && end >= now;

      return stats;
    };

    const getTrend = (current, prev) => {
      const calc = (curVal, preVal) => {
        if (!preVal) return curVal > 0 ? '+100%' : '0%';
        const diff = ((curVal - preVal) / preVal) * 100;
        return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
      };
      return {
        total: calc(current.total, prev.total),
        contracted: calc(current.contracted, prev.contracted),
        uncontracted: calc(current.uncontracted, prev.uncontracted),
        noshow: calc(current.noshow, prev.noshow)
      };
    };

    const lureWeekStats = getFilteredStats(lureWeekOffset, 'week', true);
    const lureMonthStats = getFilteredStats(lureMonthOffset, 'month', true);
    const totalWeekStats = getFilteredStats(totalWeekOffset, 'week', false);
    const totalMonthStats = getFilteredStats(totalMonthOffset, 'month', false);

    // Trend comparisons: Weekly compare with prev week (-1), Monthly compare with prev month (-1)
    const lureWeekPrev = getFilteredStats(lureWeekOffset - 1, 'week', true);
    const lureMonthPrev = getFilteredStats(lureMonthOffset - 1, 'month', true);
    const totalWeekPrev = getFilteredStats(totalWeekOffset - 1, 'week', false);
    const totalMonthPrev = getFilteredStats(totalMonthOffset - 1, 'month', false);

    const lureWeekTrend = getTrend(lureWeekStats, lureWeekPrev);
    const lureMonthTrend = getTrend(lureMonthStats, lureMonthPrev);
    const totalWeekTrend = getTrend(totalWeekStats, totalWeekPrev);
    const totalMonthTrend = getTrend(totalMonthStats, totalMonthPrev);

    const getTrendHistory = (offset, periodType, isLureOnly, count = 6) => {
      const history = [];
      for (let i = count - 1; i >= 0; i--) {
        history.push(getFilteredStats(offset - i, periodType, isLureOnly));
      }
      return history;
    };

    const lureWeekHistory = getTrendHistory(lureWeekOffset, 'week', true);
    const lureMonthHistory = getTrendHistory(lureMonthOffset, 'month', true);
    const totalWeekHistory = getTrendHistory(totalWeekOffset, 'week', false);
    const totalMonthHistory = getTrendHistory(totalMonthOffset, 'month', false);

    const lureTrend = { diff: 0, status: 'stable' };
    const totalRecordsCurrentMonth = allRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      return d && d.getFullYear() === statsMonth.getFullYear() && d.getMonth() === statsMonth.getMonth();
    }).length;

    const lastMonthDate = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - 1, 1);
    const totalRecordsLastMonth = allRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      return d && d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
    }).length;

    const lastMonthLureTotal = allRecords.filter(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      return d && r.source === '루어' && d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
    }).length;

    if (lastMonthLureTotal > 0) {
      lureTrend.diff = lureStats.total - lastMonthLureTotal;
      lureTrend.status = lureTrend.diff > 0 ? 'up' : lureTrend.diff < 0 ? 'down' : 'stable';
    }

    allRecords.forEach(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      if (!d) return;

      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      // Overall DB Stats for Current Selected Month
      if (d.getFullYear() === statsMonth.getFullYear() && d.getMonth() === statsMonth.getMonth()) {
        totalDBStats.total++;
        if (r.status === '계약') totalDBStats.contracted++;
        else if (r.status === '미계약') totalDBStats.uncontracted++;
        else if (r.status === '노쇼' || r.status === '미방문') totalDBStats.noshow++;
      }

      // Trend: 6 Months (Only 'Uncontracted' records)
      if (r.status === '미계약') {
        const trendItem = monthTrend.find(t => t.month === mKey);
        if (trendItem) trendItem.total++;
      }

      // Lure Specific Analysis (Source: '루어')
      if (r.source === '루어') {
        if (!lureMonthlyStats[mKey]) lureMonthlyStats[mKey] = { total: 0, contracted: 0, uncontracted: 0, noshow: 0 };
        lureMonthlyStats[mKey].total++;
        if (r.status === '계약') lureMonthlyStats[mKey].contracted++;
        else if (r.status === '미계약') lureMonthlyStats[mKey].uncontracted++;
        else if (r.status === '노쇼' || r.status === '미방문') lureMonthlyStats[mKey].noshow++;

        // For KPI display (current selected month)
        if (d.getFullYear() === statsMonth.getFullYear() && d.getMonth() === statsMonth.getMonth()) {
          lureStats.total++;
          if (r.status === '계약') lureStats.contracted++;
          else if (r.status === '미계약') lureStats.uncontracted++;
          else if (r.status === '노쇼' || r.status === '미방문') lureStats.noshow++;
        }
      }
    });

    // Sort trend for safety
    monthTrend.sort((a, b) => a.month.localeCompare(b.month));


    // --- Phase 3 Advanced: Salesperson 3-Month Detailed Trend & Weekly Ranking ---

    // 1. Calculate 3-Month detailed stats per salesperson
    // Target Months: statsMonth, prevStatsMonth, twoMonthsAgoStatsMonth
    const targetMonths = [twoMonthsAgoStatsMonth, prevStatsMonth, statsMonth];
    const salespersonTrend = {}; // { 'Name': { '2023-10': { contract: 0, uncontract: 0, maxAmount: 0 }, ... } }

    targetMonths.forEach(targetDate => {
      const mKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const monthRecords = allRecords.filter(r => {
        const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
        return d && d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth();
      });

      monthRecords.forEach(r => {
        const sp = r.salesperson;
        if (!sp || sp === '미지정') return; // Skip unspecified for trend
        if (!salespersonTrend[sp]) salespersonTrend[sp] = {};
        if (!salespersonTrend[sp][mKey]) salespersonTrend[sp][mKey] = { contract: 0, uncontract: 0, maxAmount: 0 };

        if (r.status === '계약') {
          salespersonTrend[sp][mKey].contract++;
          if (r.isRecovery) salespersonTrend[sp][mKey].recovery = (salespersonTrend[sp][mKey].recovery || 0) + 1;
          const amt = r.finalContractAmount ? Number(r.finalContractAmount) : 0;
          if (amt > salespersonTrend[sp][mKey].maxAmount) salespersonTrend[sp][mKey].maxAmount = amt;
        } else if (r.status === '미계약') {
          salespersonTrend[sp][mKey].uncontract++;
        }
      });
    });

    // 2. Weekly Ranking (Top 3 Highest Contract Amounts)
    const weeklyTopRankings = {}; // { '1주차': [Top3 Records], '2주차': ... }

    const getWeekOfMonth = (date) => {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const day = date.getDate();
      const adjustedDate = day + startOfMonth.getDay() - 1;
      return Math.floor(adjustedDate / 7) + 1;
    };

    // Filter only Contracted records for statsMonth
    const monthlyContracted = statsMonthRecords.filter(r => r.status === '계약' && r.finalContractAmount);

    monthlyContracted.forEach(r => {
      const d = r.reservationDate ? new Date(r.reservationDate) : (r.createdAt?.toDate ? r.createdAt.toDate() : new Date());
      const weekNum = `${getWeekOfMonth(d)}주차`;
      if (!weeklyTopRankings[weekNum]) weeklyTopRankings[weekNum] = [];
      weeklyTopRankings[weekNum].push(r);
    });

    // Sort and slice Top 3 for each week
    Object.keys(weeklyTopRankings).forEach(week => {
      weeklyTopRankings[week].sort((a, b) => Number(b.finalContractAmount) - Number(a.finalContractAmount));
      weeklyTopRankings[week] = weeklyTopRankings[week].slice(0, 3);
    });


    // --- Phase 3: Matrix Analytics Helper ---
    const calculateMatrix = (records, key, label) => {
      const matrix = {};
      records.forEach(r => {
        const val = r[key] || 'Unspecified';
        if (!matrix[val]) {
          matrix[val] = {
            [label]: val,
            '전체': 0,
            '계약': 0,
            '재계약': 0,
            '미계약': 0,
            '노쇼': 0,
            '성공률': 0,
            '매출합계': 0
          };
        }

        matrix[val]['전체']++;
        if (r.status === '계약') {
          matrix[val]['계약']++;
          if (r.isRecovery) matrix[val]['재계약']++;
          if (r.finalContractAmount) matrix[val]['매출합계'] += Number(r.finalContractAmount);
        }
        else if (r.status === '미계약') matrix[val]['미계약']++;
        else if (r.status === '노쇼' || r.status === '미방문') matrix[val]['노쇼']++;
      });

      return Object.values(matrix)
        .filter(row => label !== '상담자명' || row[label] !== 'Unspecified') // Filter out unassigned for salespersons
        .map(row => ({
          ...row,
          '성공률': row['전체'] > 0 ? `${Math.round((row['계약'] / row['전체']) * 100)}%` : '0%'
        })).sort((a, b) => b['전체'] - a['전체']);
    };



    const sourceStatsMatrix = calculateMatrix(allRecords, 'source', '유입경로');
    const branchStatsMatrix = calculateMatrix(allRecords, 'branch', '지점명');
    const salespersonStatsMatrix = calculateMatrix(allRecords, 'salesperson', '상담자명');

    // For compatibility with existing charts (Red/Gray bars), strictly count unclosed reasons
    // But since we are moving to matrix, we can adapt charts later. For now, keep basic monthly counts for charts.

    // Map Salesperson to Branch for coloring
    const salespersonBranchMap = {};
    allRecords.forEach(r => {
      if (r.salesperson && r.branch) {
        salespersonBranchMap[r.salesperson] = r.branch;
      }
    });

    return {
      monthlySalespersons,
      monthlyBranches,
      prevMonthlySalespersons: prevStats.sp,
      prevMonthlyBranches: prevStats.br,
      twoMonthsAgoMonthlySalespersons: twoAgoStats.sp,
      twoMonthsAgoMonthlyBranches: twoAgoStats.br,
      monthlySources,
      monthlyReasons,
      monthlyNoShowsByBranch,
      totalDBStats,
      lureStats,
      lureMonthlyStats,
      monthTrend,
      salespersonBranchMap,
      totalRecordsCurrentMonth,
      totalRecordsLastMonth,
      lureTrend,
      // Phase 3 Matrices
      sourceStatsMatrix,
      branchStatsMatrix,
      salespersonStatsMatrix,
      salespersonTrend,
      targetMonths: targetMonths.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
      weeklyTopRankings,
      lureWeekStats,
      lureMonthStats,
      totalWeekStats,
      totalMonthStats,
      lureWeekTrend,
      lureMonthTrend,
      totalWeekTrend,
      totalMonthTrend,
      lureWeekHistory,
      lureMonthHistory,
      totalWeekHistory,
      totalMonthHistory
    };
  }, [customerRecords, statsMonth, lureWeekOffset, lureMonthOffset, totalWeekOffset, totalMonthOffset]);






  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="bg-white p-8 rounded-lg shadow-xl text-center"><h2 className="text-2xl font-bold text-red-600">오류 발생!</h2><p>{error}</p></div></div>;
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col" ref={topOfPageRef}>
      <header className="bg-white p-2 px-6 shadow-sm flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 w-full">
        <div className="flex items-center mb-1 md:mb-0">
          <ClipboardList className="w-5 h-5 text-red-600 mr-2" />
          <h1 className="text-lg font-black text-gray-800 tracking-tight">계약관리 CRM</h1>
        </div>

        <div className="flex bg-gray-100 p-2 rounded-2xl gap-2 mb-2 md:mb-0 shadow-inner w-full max-w-4xl mx-auto overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('contract_dashboard')}
            className={`flex-1 px-4 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'contract_dashboard' ? 'bg-white text-red-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
          >
            계약대시보드
          </button>
          <button
            onClick={() => setActiveTab('registration_consultation')}
            className={`flex-1 px-4 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'registration_consultation' ? 'bg-white text-red-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
          >
            등록·상담
          </button>
          <button
            onClick={() => setActiveTab('db_list')}
            className={`flex-1 px-4 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all whitespace-nowrap ${activeTab === 'db_list' ? 'bg-white text-red-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
          >
            DB리스트
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 py-1 border border-gray-200">
                <button
                  onClick={() => openSettingsModal('sources', '방문경로', sources)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  방문경로 관리
                </button>
                <button
                  onClick={() => openSettingsModal('reasons', '미계약 사유', reasons)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  미계약 사유 관리
                </button>
                <button
                  onClick={() => openSettingsModal('branches', '지점', branches)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  지점 목록 관리
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mr-4 hidden sm:block font-bold">
            사용자
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Hidden Report Template for Capture */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <div ref={reportRef}>
            <ReportTemplate
              data={dashboardData}
              month={statsMonth}
            />
          </div>
        </div>

        {/* --- 1. Dashboard Tab (Stats & Charts) --- */}
        {activeTab === 'contract_dashboard' && (
          <div className="space-y-6">
            {/* Dashboard Container: Lure(Blue) and Total(Red) nested structure */}
            <div className="flex flex-col xl:flex-row gap-6 w-full items-stretch">
              {/* Lure Section (BLUE) */}
              <div className="flex-1 flex flex-col gap-4 bg-[#0F172A] p-6 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]"></div>

                <h2 className="text-lg font-black text-white px-2 flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                  루어 DB 성과 현황
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  <SegmentContainer
                    title="월간 루어"
                    stats={dashboardData.lureMonthStats}
                    trend={dashboardData.lureMonthTrend}
                    color="blue"
                    onPrev={() => setLureMonthOffset(p => p - 1)}
                    onNext={() => setLureMonthOffset(p => p + 1)}
                    onMetricClick={(status, period) => setDashboardListFilter({ type: 'lure', period, status, label: `${dashboardData.lureMonthStats.label} 루어`, records: dashboardData.lureMonthStats.records })}
                    periodType="month"
                    history={dashboardData.lureMonthHistory}
                    onZoom={() => setZoomedSegment('lureMonth')}
                  />
                  <SegmentContainer
                    title="주간 루어"
                    stats={dashboardData.lureWeekStats}
                    trend={dashboardData.lureWeekTrend}
                    color="blue"
                    onPrev={() => setLureWeekOffset(p => p - 1)}
                    onNext={() => setLureWeekOffset(p => p + 1)}
                    onMetricClick={(status, period) => setDashboardListFilter({ type: 'lure', period, status, label: `${dashboardData.lureWeekStats.label} 루어`, records: dashboardData.lureWeekStats.records })}
                    periodType="week"
                    history={dashboardData.lureWeekHistory}
                    onZoom={() => setZoomedSegment('lureWeek')}
                  />
                </div>
              </div>

              {/* Total Section (RED) */}
              <div className="flex-1 flex flex-col gap-4 bg-[#450A0A] p-6 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 rounded-full blur-[100px]"></div>

                <h2 className="text-lg font-black text-white px-2 flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-rose-500 rounded-full"></div>
                  전체 통합 성과 요약
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  <SegmentContainer
                    title="월간 통합"
                    stats={dashboardData.totalMonthStats}
                    trend={dashboardData.totalMonthTrend}
                    color="red"
                    onPrev={() => setTotalMonthOffset(p => p - 1)}
                    onNext={() => setTotalMonthOffset(p => p + 1)}
                    onMetricClick={(status, period) => setDashboardListFilter({ type: 'total', period, status, label: `${dashboardData.totalMonthStats.label} 통합`, records: dashboardData.totalMonthStats.records })}
                    periodType="month"
                    history={dashboardData.totalMonthHistory}
                    onZoom={() => setZoomedSegment('totalMonth')}
                  />
                  <SegmentContainer
                    title="주간 통합"
                    stats={dashboardData.totalWeekStats}
                    trend={dashboardData.totalWeekTrend}
                    color="red"
                    onPrev={() => setTotalWeekOffset(p => p - 1)}
                    onNext={() => setTotalWeekOffset(p => p + 1)}
                    onMetricClick={(status, period) => setDashboardListFilter({ type: 'total', period, status, label: `${dashboardData.totalWeekStats.label} 통합`, records: dashboardData.totalWeekStats.records })}
                    periodType="week"
                    history={dashboardData.totalWeekHistory}
                    onZoom={() => setZoomedSegment('totalWeek')}
                  />
                </div>
              </div>

              {/* Segment Zoom Modal */}
              {zoomedSegment && (
                <SegmentZoomModal
                  type={zoomedSegment}
                  dashboardData={dashboardData}
                  onClose={() => setZoomedSegment(null)}
                  onPrev={() => {
                    if (zoomedSegment === 'lureMonth') setLureMonthOffset(p => p - 1);
                    else if (zoomedSegment === 'lureWeek') setLureWeekOffset(p => p - 1);
                    else if (zoomedSegment === 'totalMonth') setTotalMonthOffset(p => p - 1);
                    else if (zoomedSegment === 'totalWeek') setTotalWeekOffset(p => p - 1);
                  }}
                  onNext={() => {
                    if (zoomedSegment === 'lureMonth') setLureMonthOffset(p => p + 1);
                    else if (zoomedSegment === 'lureWeek') setLureWeekOffset(p => p + 1);
                    else if (zoomedSegment === 'totalMonth') setTotalMonthOffset(p => p + 1);
                    else if (zoomedSegment === 'totalWeek') setTotalWeekOffset(p => p + 1);
                  }}
                  onMetricClick={(status, period) => {
                    const seg = zoomedSegment.startsWith('lure') ? 'lure' : 'total';
                    const baseStats = dashboardData[`${zoomedSegment}Stats`];
                    setDashboardListFilter({ type: seg, period, status, label: `${baseStats.label} ${seg === 'lure' ? '루어' : '통합'}`, records: baseStats.records });
                  }}
                />
              )}
            </div>

            {/* Dashboard List Detail (Appear on click) */}
            {dashboardListFilter && (
              <DetailedDashboardList
                filter={dashboardListFilter}
                records={dashboardListFilter.records}
                onClose={() => setDashboardListFilter(null)}
                onRecordClick={(r) => { setSelectedConsultationRecord(r); setShowConsultationModal(true); }}
                onExport={handleExportDetailReport}
              />
            )}

            {/* Weekly Ranking Section (Moved here) */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center">
                <Trophy className="w-6 h-6 text-yellow-500 mr-2" />
                주차별 계약 랭킹 (Top 3)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(dashboardData.weeklyTopRankings).sort().map(week => (
                  <div key={week} className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                    <h4 className="font-black text-gray-700 mb-4 border-b border-gray-200/50 pb-2 flex justify-between items-center">
                      <span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px] uppercase">{week}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">최고 계약금액 순</span>
                    </h4>
                    <div className="space-y-4">
                      {dashboardData.weeklyTopRankings[week].map((r, idx) => (
                        <div
                          key={r.id}
                          onClick={() => { setSelectedConsultationRecord(r); setShowConsultationModal(true); }}
                          className="flex items-center justify-between group cursor-pointer hover:bg-white p-1 rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[12px] font-black text-white shadow-sm
                              ${idx === 0 ? 'bg-yellow-400 ring-4 ring-yellow-50' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}
                            `}>
                              {idx + 1}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-[14px] text-gray-800">{r.salesperson}</span>
                              <span className="text-[10px] font-bold text-gray-400">{r.customerName}</span>
                            </div>
                          </div>
                          <span className="font-black text-blue-600 text-[14px] bg-blue-50 px-2 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {Number(r.finalContractAmount).toLocaleString()}원
                          </span>
                        </div>
                      ))}
                      {dashboardData.weeklyTopRankings[week].length === 0 && <div className="text-gray-400 text-xs font-bold text-center py-4 bg-white/50 rounded-xl border border-dashed border-gray-200">기록 없음</div>}
                    </div>
                  </div>
                ))}
                {Object.keys(dashboardData.weeklyTopRankings).length === 0 && <div className="text-gray-400 col-span-3 text-center py-10 font-bold">이번 달 계약 데이터가 없습니다.</div>}
              </div>
            </div>


            {/* Charts Section - Reorganized Separated */}
            <div className="flex flex-col gap-6 mb-6">

              {/* Chart Header & Controls */}
              <div className="bg-white p-4 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center sticky top-20 z-10 gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-gray-700">지점/상담자별 실적 비교 (선택 월 성과)</h2>
                  {userRole === 'admin' && (
                    <button
                      onClick={handleDownloadReport}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-red-700 transition-all hover:scale-105 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      월간 보고서 다운로드 (A4)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl shadow-inner">
                  <button onClick={() => setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-black text-gray-700 text-sm px-4">{statsMonth.toLocaleString('ko-KR', { year: 'numeric', month: 'long' })}</span>
                  <button onClick={() => setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Branch Stats Section */}
              <div className="bg-white p-6 rounded-2xl shadow-lg">
                <div className="mb-4 border-b border-gray-100 pb-2">
                  <h3 className="text-lg font-bold text-gray-700">지점별 실적 비교</h3>
                  <p className="text-sm text-gray-400">각 지점의 최근 3개월 미계약 건수 추이입니다.</p>
                </div>
                <VerticalComparisonBarChart
                  currentData={dashboardData.monthlyBranches}
                  prevData={dashboardData.prevMonthlyBranches}
                  twoMonthsAgoData={dashboardData.twoMonthsAgoMonthlyBranches}
                  colors={branchColors}
                />
              </div>

              <SalespersonTrendSection
                trendData={dashboardData.salespersonTrend}
                targetMonths={dashboardData.targetMonths}
                salespersonSearch={salespersonSearch}
                setSalespersonSearch={setSalespersonSearch}
              />



              {userRole === 'admin' && (
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                  <div className="mb-4 border-b border-gray-50 pb-2">
                    <h3 className="text-lg font-black text-gray-800">상담자별 전체 통계</h3>
                    <p className="text-[11px] font-bold text-gray-400 tracking-tighter">선택 월 기준 모든 상담자의 성과 지표입니다.</p>
                  </div>
                  <MatrixTable
                    data={dashboardData.salespersonStatsMatrix}
                    title="상담자명"
                    onRowClick={(name) => {
                      setSelectedSalesperson(name);
                      setShowPerformanceModal(true);
                    }}
                  />
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- 2. 업무 센터 (등록·상담) --- */}
        {activeTab === 'registration_consultation' && (
          <div className="space-y-6">
            {/* 1. 고객리스트 (상단 배치) */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-yellow-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-100 rounded-xl">
                    <History className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">고객리스트</h3>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="대기 고객 또는 상담자 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full md:w-64 pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm whitespace-nowrap">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    <span className="text-yellow-800 font-bold text-xs">{filteredAndSortedRecords.length}</span>
                  </div>
                  <button
                    onClick={() => setIsWaitingListExpanded(!isWaitingListExpanded)}
                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-500 transition-all"
                  >
                    {isWaitingListExpanded ? <ChevronDown className="w-6 h-6 transform rotate-180" /> : <ChevronDown className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {isWaitingListExpanded && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <PaginatedTable
                    title=""
                    records={filteredAndSortedRecords}
                    recordsPerPage={10}
                    currentPage={unclosedPage}
                    setCurrentPage={setUnclosedPage}
                    columns={['방문일시', '지점/경로', '고객정보', '상태', '메모 내용', '관리']}
                    renderRow={r => (
                      <tr
                        key={r.id}
                        onClick={() => handleSelectWaitingCustomer(r)}
                        className={`hover: bg - yellow - 50 / 50 transition - colors cursor - pointer group ${newCustomerForm.existingRecordId === r.id ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400' : ''} `}
                      >
                        <td className="px-2 py-1.5 text-sm">
                          <div className="font-black text-gray-500 text-[11px] leading-none">{r.reservationDate || '-'}</div>
                          <div className="text-[10px] text-red-500 font-black">{r.reservationTime}</div>
                        </td>
                        <td className="px-2 py-1.5 text-sm">
                          <div className="font-bold text-gray-700 text-[11px] leading-none">{r.branch}</div>
                          <div className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">{r.source}</div>
                        </td>
                        <td className="px-2 py-1.5 text-sm">
                          <div className="font-black text-gray-800 text-[12px] leading-tight">{r.customerName}</div>
                          <div className="text-[9px] text-gray-400 font-bold">{r.customerContact}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-100/50 text-yellow-700 rounded-lg text-[8px] font-black ring-1 ring-yellow-200 whitespace-nowrap">
                            대기
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-gray-500 max-w-[150px] xl:max-w-xs">
                          <p className="line-clamp-1 leading-relaxed italic">{r.memo || r.consultationContent || r.recordContent || '-'}</p>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectWaitingCustomer(r); }}
                              className="bg-yellow-500 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-yellow-600 shadow-md transition-all active:scale-95 whitespace-nowrap"
                            >
                              선택
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openConfirmDeleteModal(r.id); }}
                              className="bg-gray-100 text-gray-400 p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  />
                </div>
              )}
            </div>

            <div id="consultation-form-section" className={`bg - white p - 5 md: p - 7 rounded - 3xl shadow - xl border transition - all duration - 500 ${newCustomerForm.isProcessingExisting ? 'border-yellow-400 ring-4 ring-yellow-50' : 'border-gray-100'} `}>
              <div className="flex flex-col gap-5 border-b border-gray-100 pb-6 mb-6">
                {newCustomerForm.isProcessingExisting && (
                  <div className="flex w-full mb-3 gap-2">
                    <button
                      type="button"
                      onClick={handleCancelSelection}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-black bg-red-50 text-red-600 border border-red-100 shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <X className="w-5 h-5" /> 선택 취소 (새로 등록)
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 bg-gray-50 border border-gray-100 p-1 rounded-2xl w-full shadow-sm gap-1">
                  {!newCustomerForm.isProcessingExisting && (
                    <button
                      type="button"
                      onClick={() => setNewCustomerForm(prev => ({ ...prev, mode: 'pending', isImmediateConsult: false }))}
                      className={`px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${newCustomerForm.mode === 'pending'
                        ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-blue-50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                        }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> 단순 DB 등록
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNewCustomerForm(prev => ({ ...prev, mode: 'contracted', isImmediateConsult: true, status: '계약' }))}
                    className={`px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${newCustomerForm.mode === 'contracted'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                      }`}
                  >
                    <Trophy className="w-3.5 h-3.5" /> 계약 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerForm(prev => ({ ...prev, mode: 'uncontracted', isImmediateConsult: true, status: '미계약' }))}
                    className={`px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${newCustomerForm.mode === 'uncontracted'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                      }`}
                  >
                    <X className="w-3.5 h-3.5" /> 미계약
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerForm(prev => ({ ...prev, mode: 'noshow', isImmediateConsult: true, status: '노쇼' }))}
                    className={`px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${newCustomerForm.mode === 'noshow'
                      ? 'bg-gray-800 text-white shadow-lg shadow-gray-300'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                      }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> 노쇼/취소
                  </button>
                </div>
              </div>

              {/* Duplicate Warning */}
              {showDuplicateWarning && !newCustomerForm.isProcessingExisting && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 text-orange-800 font-bold mb-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    이미 등록된 고객 정보가 있는 것 같습니다.
                  </div>
                  <div className="space-y-2">
                    {duplicateLeads.map(lead => (
                      <div key={lead.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg border border-orange-100 gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{lead.customerName}</span>
                            <span className={`px - 2 py - 0.5 rounded text - [10px] font - bold ${lead.status === '대기' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'} `}>
                              {lead.status}
                            </span>
                          </div>
                          <span className="text-gray-500 text-sm">{lead.customerContact}</span>
                          <div className="text-xs text-gray-400 mt-1">{lead.branch} 지점 | {lead.salesperson || '상담자 미정'}</div>
                        </div>
                        {lead.status === '대기' ? (
                          <button
                            onClick={() => handleSelectWaitingCustomer(lead)}
                            className="w-full sm:w-auto px-4 py-1.5 bg-yellow-500 text-white text-sm font-bold rounded-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" /> 기존 데이터로 상담진행하기
                          </button>
                        ) : (
                          <button
                            onClick={() => { setSelectedConsultationRecord(lead); setShowConsultationModal(true); }}
                            className="w-full sm:w-auto px-4 py-1.5 bg-gray-700 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors flex items-center justify-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" /> 기존 데이터 상세 보기
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3 text-center">* 중복 DB가 아니라면 아래 양식을 계속 작성해 주세요.</p>
                </div>
              )}

              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 mb-4 transition-all overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-5 h-5 text-gray-500" />
                      <h4 className="text-sm font-black text-gray-700">고객 데이터 (DB 정보)</h4>
                    </div>
                    {newCustomerForm.isProcessingExisting && (
                      <button
                        type="button"
                        onClick={() => setNewCustomerForm(prev => ({ ...prev, showDbInfo: !prev.showDbInfo }))}
                        className="text-[11px] font-bold text-blue-600 underline"
                      >
                        {newCustomerForm.showDbInfo ? '닫기' : '입력 내용 보기/수정'}
                      </button>
                    )}
                  </div>

                  {(!newCustomerForm.isProcessingExisting || newCustomerForm.showDbInfo) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      {/* Branch & Source */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">지점</label>
                        <div className="relative">
                          <select name="branch" value={newCustomerForm.branch} onChange={handleCustomerFormChange} className="w-full p-3 border border-gray-300 rounded-xl appearance-none bg-white text-sm font-bold">
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">방문 경로</label>
                        <div className="relative">
                          <select name="source" value={newCustomerForm.source} onChange={handleCustomerFormChange} className="w-full p-3 border border-gray-300 rounded-xl appearance-none bg-white text-sm font-bold">
                            {sources.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        </div>
                      </div>

                      {/* Creator & TM & Salesperson (Only for Pending Mode) */}
                      {newCustomerForm.mode === 'pending' && (
                        <div className={`md: col - span - 2 bg - white p - 4 rounded - 2xl border border - gray - 100`}>
                          <div className="flex items-center gap-2 mb-3">
                            <UserRound className="w-4 h-4 text-blue-600" />
                            <label className="text-sm font-black text-gray-700">상담 배정 및 입력 정보</label>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-0.5">상담자 (배정)</label>
                              <input
                                type="text"
                                name="salesperson"
                                value={newCustomerForm.salesperson}
                                onChange={handleCustomerFormChange}
                                placeholder="상담자 이름"
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-0.5">DB 입력자</label>
                              <input
                                type="text"
                                name="dbCreator"
                                value={newCustomerForm.dbCreator}
                                onChange={handleCustomerFormChange}
                                placeholder="작성자 이름"
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-0.5">TM/참고인 (선택)</label>
                              <input type="text" name="tmPerson" value={newCustomerForm.tmPerson} onChange={handleCustomerFormChange} placeholder="TM 상담자" className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Customer Info */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">고객명</label>
                        <input type="text" name="customerName" value={newCustomerForm.customerName} onChange={handleCustomerFormChange} required className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold" placeholder="신랑이름/신부이름" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">연락처</label>
                        <input type="tel" name="customerContact" value={newCustomerForm.customerContact} onChange={handleCustomerFormChange} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold" placeholder="010-0000-0000" />
                      </div>

                      {/* Dates */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">예약/방문 날짜</label>
                        <input type="date" name="reservationDate" value={newCustomerForm.reservationDate} onChange={handleCustomerFormChange} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">예약 시간</label>
                        <input type="time" name="reservationTime" value={newCustomerForm.reservationTime} onChange={handleCustomerFormChange} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Memo */}
                {!newCustomerForm.isProcessingExisting && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">메모 (특이사항)</label>
                    <textarea name="memo" value={newCustomerForm.memo} onChange={handleCustomerFormChange} rows="2" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="박람회 및 TM 시 고객 정보 메모란"></textarea>
                  </div>
                )}

                {/* Immediate Result Fields */}
                {newCustomerForm.mode !== 'pending' && (
                  <div className="mt-6 pt-6 border-t border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="w-5 h-5 text-blue-500" />
                      <h4 className="font-bold text-blue-900">상담 결과 즉시 입력: {
                        newCustomerForm.mode === 'contracted' ? '계약' :
                          newCustomerForm.mode === 'uncontracted' ? '미계약' : '노쇼'
                      }</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1 ml-1">
                          <label className="block text-sm font-bold text-gray-700">상담자 <span className="text-red-500">*</span></label>
                          <label className="flex items-center text-[10px] text-blue-600 font-black cursor-pointer bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            <input
                              type="checkbox"
                              name="isSameAsConsultant"
                              checked={newCustomerForm.isSameAsConsultant}
                              onChange={handleCustomerFormChange}
                              className="mr-1 w-3 h-3"
                            />
                            상담자 = 입력자 동일 적용
                          </label>
                        </div>
                        <input type="text" name="salesperson" value={newCustomerForm.salesperson} onChange={handleCustomerFormChange} required={newCustomerForm.mode !== 'pending'} className="w-full p-2.5 border border-blue-200 rounded-xl focus:ring-blue-500 bg-blue-50/50 font-bold" placeholder="상담자 입력" />
                      </div>

                      {!newCustomerForm.isSameAsConsultant && (
                        <div className="animate-in fade-in slide-in-from-left-2 transition-all">
                          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">DB 입력자</label>
                          <input
                            type="text"
                            name="dbCreator"
                            value={newCustomerForm.dbCreator}
                            onChange={handleCustomerFormChange}
                            placeholder="작성자 이름"
                            className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {newCustomerForm.mode === 'contracted' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-blue-900 mb-1">최종결제금액 (순위정산용) 단위:원</label>
                          <input type="text" name="finalContractAmount" value={formatWithCommas(newCustomerForm.finalContractAmount)} onChange={handleCustomerFormChange} className="w-full p-2 border border-blue-200 rounded-lg font-bold" placeholder="원화단위 입력 예) 990,000" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-blue-900 mb-1">상세 계약금액/메모</label>
                          <textarea
                            name="contractAmount"
                            value={newCustomerForm.contractAmount}
                            onChange={handleCustomerFormChange}
                            rows="6"
                            className="w-full p-2 border border-blue-200 rounded-lg mb-3 text-sm leading-relaxed"
                            placeholder={`예) 하드 (219) 조끼 (40)\n기성대체  (30)\n정장1 조끼1 셔츠2 구두1 대여2\n총 289(28,9)-317,9\n박 30\n계 287,9\n잔 x`}
                          />
                          <label className="block text-sm font-semibold text-blue-900 mb-1">계약과정 및 상담내용 작성</label>
                          <textarea
                            name="consultationContent"
                            value={newCustomerForm.consultationContent}
                            onChange={handleCustomerFormChange}
                            rows="4"
                            className="w-full p-2 border border-blue-200 rounded-lg text-sm"
                            placeholder="예) 상담내용 + 체촌여부 + 상담시간 + 반도진행 여부 등"
                          />
                        </div>
                      </div>
                    )}

                    {newCustomerForm.mode === 'uncontracted' && (
                      <div className="space-y-3 bg-red-50 p-4 rounded-xl border border-red-100">
                        <div>
                          <label className="block text-sm font-semibold text-red-900 mb-1">미계약 사유</label>
                          <select name="reason" value={newCustomerForm.reason} onChange={handleCustomerFormChange} className="w-full p-2 border border-red-200 rounded-lg bg-white">
                            <option value="">사유 선택</option>
                            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-red-900 mb-1">상담 상세 내용</label>
                          <textarea name="consultationContent" value={newCustomerForm.consultationContent} onChange={handleCustomerFormChange} rows="3" className="w-full p-2 border border-red-200 rounded-lg" placeholder="미계약 원인 등"></textarea>
                        </div>
                      </div>
                    )}

                    {newCustomerForm.mode === 'noshow' && (
                      <div className="space-y-3 bg-gray-100 p-4 rounded-xl border border-gray-200">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">노쇼 사유 / 메모</label>
                          <textarea name="consultationContent" value={newCustomerForm.consultationContent} onChange={handleCustomerFormChange} rows="3" className="w-full p-2 border border-gray-300 rounded-lg" placeholder="부재중, 당일 취소 등"></textarea>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100">
                  <button type="submit" className={`w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center text-lg ${newCustomerForm.mode === 'contracted' ? 'bg-blue-600 hover:bg-blue-700' :
                    newCustomerForm.mode === 'uncontracted' ? 'bg-red-500 hover:bg-red-600' :
                      newCustomerForm.mode === 'noshow' ? 'bg-black hover:bg-gray-800' :
                        newCustomerForm.isProcessingExisting ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-600 hover:bg-red-700'
                    }`}>
                    {newCustomerForm.isProcessingExisting ? (
                      <History className="w-6 h-6 mr-2" />
                    ) : (
                      <Plus className="w-6 h-6 mr-2" />
                    )}
                    {newCustomerForm.isProcessingExisting ? (
                      newCustomerForm.mode === 'contracted' ? '계약 완료 및 등록' :
                        newCustomerForm.mode === 'uncontracted' ? '미계약 건 등록' :
                          newCustomerForm.mode === 'noshow' ? '노쇼(미방문) 등록' : '상담 결과 저장'
                    ) : (
                      newCustomerForm.mode === 'contracted' ? '계약 완료 및 등록' :
                        newCustomerForm.mode === 'uncontracted' ? '미계약 건 등록' :
                          newCustomerForm.mode === 'noshow' ? '노쇼(미방문) 등록' : '새로운 고객 등록하기'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- 3. DB리스트 (전체 기록 + 통합 검색) --- */}
        {activeTab === 'db_list' && (
          <div className="space-y-6">
            <div className="bg-white p-3 px-5 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
                <div className="grid grid-cols-4 md:flex items-center bg-gray-50 border border-gray-100 p-1 rounded-2xl w-full md:w-auto shadow-sm gap-1">
                  {[
                    { id: 'all', label: '전체', color: 'blue' },
                    { id: 'contracted', label: '계약', color: 'blue' },
                    { id: 'uncontracted', label: '미계약', color: 'rose' },
                    { id: 'noshow', label: '노쇼', color: 'gray' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 md:min-w-[80px] ${statusFilter === tab.id
                        ? (tab.id === 'all' || tab.id === 'contracted' ? 'bg-blue-600 text-white shadow-md' : tab.id === 'uncontracted' ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-800 text-white shadow-md')
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow min-w-[200px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="고객명, 연락처, 상담자 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold shadow-sm"
                    />
                  </div>
                  <div className="relative">
                    <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="appearance-none w-full sm:w-auto pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-black focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm">
                      <option value="all">모든 방문 경로</option>
                      {sources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <PaginatedTable
              title=""
              records={filteredAndSortedRecords}
              recordsPerPage={recordsPerPage}
              currentPage={unclosedPage}
              setCurrentPage={setUnclosedPage}
              columns={['방문일', '출처', '지점/상담자', '고객정보', '결과/상태', '최근 기록', '관리']}
              renderRow={r => (
                <tr
                  key={r.id}
                  onClick={() => { setSelectedConsultationRecord(r); setShowConsultationModal(true); }}
                  className="hover:bg-blue-50/50 transition-all cursor-pointer group border-b border-gray-50"
                >
                  <td className="px-3 py-4 text-sm whitespace-nowrap">
                    <div className="font-bold text-gray-700">{r.reservationDate || (r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ko-KR') : (r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : '-'))}</div>
                    <div className="text-[10px] text-gray-400">{r.reservationTime}</div>
                  </td>
                  <td className="px-3 py-4 text-sm hidden sm:table-cell"><span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black text-gray-500 uppercase">{r.source}</span></td>
                  <td className="px-3 py-4 text-sm">
                    <div className="font-bold text-gray-800 text-xs sm:text-sm">{r.branch === '신사' ? '도산' : r.branch}</div>
                    <div className="text-[10px] sm:text-xs text-blue-600 font-bold">{r.salesperson || '미지정'}</div>
                  </td>
                  <td className="px-3 py-4 text-sm font-medium">
                    <div className="font-black text-gray-800 sm:text-base">{r.customerName}</div>
                    <div className="text-[11px] text-gray-500 hidden sm:block">{r.customerContact}</div>
                  </td>
                  <td className="px-3 py-4 text-sm">
                    <span className={`px - 2 py - 0.5 rounded - full text - [10px] font - black 
                      ${r.status === '계약' ? 'bg-blue-100 text-blue-700' :
                        r.status === '미계약' ? 'bg-red-100 text-red-700' :
                          r.status === '대기' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                      } `}>
                      {r.status}
                    </span>
                    {r.status === '미계약' && r.reason && <div className="text-[10px] text-red-400 font-bold mt-1 hidden sm:block">[{r.reason}]</div>}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-400 italic max-w-[120px] sm:max-w-xs truncate text-xs">
                    {r.consultationContent || r.memo || r.recordContent || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button className="text-gray-300 group-hover:text-blue-600 transition-colors"><Search className="w-5 h-5" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openConfirmDeleteModal(r.id); }}
                        className="text-gray-300 hover:text-red-500 transition-colors hidden sm:block"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        )}


      </div>



      {
        showSettingsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-lg shadow-xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-xl font-bold">{editingList.title} 목록 관리</h3>
                <button onClick={() => setShowSettingsModal(false)}><X className="w-6 h-6 text-gray-500 hover:text-gray-800" /></button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItemToList()}
                    placeholder="새 항목 추가..."
                    className="flex-grow p-2 border border-gray-300 rounded-md"
                  />
                  <button onClick={handleAddItemToList} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">추가</button>
                </div>
                <div className="space-y-2">
                  {editingList.items.map(item => (
                    <div key={item} className={`flex justify - between items - center p - 2 rounded - md ${item === '노쇼' ? 'bg-gray-200' : 'bg-gray-100'} `}>
                      <span>
                        {item}
                        {item === '노쇼' && <span className="text-xs text-gray-500 ml-2">(미계약 개수에 카운팅되지 않습니다.)</span>}
                      </span>
                      {item !== '노쇼' && (
                        <button onClick={() => handleDeleteItemFromList(item)}><Trash2 className="w-5 h-5 text-red-500 hover:text-red-700" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 space-y-3">
                <button
                  onClick={handleCleanupData}
                  className="w-full py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-bold flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  기존 데이터 필드 정리 (Cleanup)
                </button>
                <button
                  onClick={handleMigrateData}
                  className="w-full py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 font-bold flex items-center justify-center gap-2"
                >
                  <History className="w-4 h-4" />
                  과거 미계약 데이터 통합 (Migration)
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  * 필드 정리: 잘못 생성된 필드를 기존 salesperson 필드로 통합하고 재계약을 보정합니다.<br />
                  * 데이터 통합: 과거 미계약DB에서 신규DB로 데이터를 가져옵니다.
                </p>
              </div>
            </div>
          </div>
        )
      }

      {/* Salesperson Performance Detail Modal */}
      {
        showPerformanceModal && selectedSalesperson && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="bg-blue-600 p-6 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedSalesperson} 상담자</h3>
                    <p className="text-blue-100 text-sm">최근 3개월 실적 통합 보고서</p>
                  </div>
                </div>
                <button onClick={() => setShowPerformanceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.keys(dashboardData.salespersonTrend[selectedSalesperson] || {})
                    .sort()
                    .reverse()
                    .slice(0, 3)
                    .map(month => {
                      const stats = dashboardData.salespersonTrend[selectedSalesperson][month];
                      const total = stats.contract + stats.uncontract;
                      const cRate = total > 0 ? ((stats.contract / total) * 100).toFixed(1) : 0;
                      return (
                        <div key={month} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                          <p className="text-blue-600 font-bold text-sm mb-3 border-b border-blue-100 pb-2">{month}</p>
                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <span className="text-sm text-gray-500 font-medium">신규 계약</span>
                              <span className="text-lg font-bold text-gray-800">{stats.contract - (stats.recovery || 0)}건</span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-sm text-green-600 font-medium">재계약 성공</span>
                              <span className="text-lg font-bold text-green-600">{stats.recovery || 0}건</span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-sm text-red-500 font-medium">미계약</span>
                              <span className="text-lg font-bold text-red-700">{stats.uncontract}건</span>
                            </div>
                            <div className="pt-2 border-t border-gray-100 mt-2 flex justify-between items-center text-xs">
                              <span className="text-gray-400">성공률</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">{cRate}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl">
                  <h4 className="flex items-center gap-2 text-blue-800 font-bold mb-4">
                    <Trophy className="w-5 h-5" />
                    누적 성과 요약
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    {(() => {
                      const trend = dashboardData.salespersonTrend[selectedSalesperson] || {};
                      let totalC = 0, totalU = 0, totalR = 0, maxA = 0;
                      Object.values(trend).forEach(m => {
                        totalC += m.contract;
                        totalU += m.uncontract;
                        totalR += (m.recovery || 0);
                        if (m.maxAmount > maxA) maxA = m.maxAmount;
                      });
                      const tTotal = totalC + totalU;
                      const tRate = tTotal > 0 ? ((totalC / tTotal) * 100).toFixed(1) : 0;
                      return (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">총 계약</p>
                            <p className="text-xl font-bold text-blue-600">{totalC}건</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">재발굴 성공</p>
                            <p className="text-xl font-bold text-green-600">{totalR}건</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">전체 성공률</p>
                            <p className="text-xl font-bold text-gray-800">{tRate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">최고 계약금</p>
                            <p className="text-xl font-bold text-gray-800">{maxA.toLocaleString()}원</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200 text-center">
                <button
                  onClick={() => setShowPerformanceModal(false)}
                  className="px-8 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors shadow-lg"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )
      }
      {showRevertConfirmModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><div className="p-6 bg-white w-full max-w-md rounded-lg shadow-xl text-center"><AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" /><h3 className="text-xl font-bold mb-4">미계약으로 되돌리기</h3><p className="mb-6 text-gray-600">이 작업을 수행하면 재계약 과정 기록과 모든 후속 코멘트가 영구적으로 삭제됩니다. 진행하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowRevertConfirmModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleRevertToUnclosed} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">확인</button></div></div></div>}
      {showRecontractModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><form onSubmit={handleConfirmRecontract} className="p-6 bg-white w-full max-w-lg rounded-lg shadow-xl"><h3 className="text-xl font-bold mb-4">재계약 기록 입력</h3><div className="space-y-4"><div><label className="block text-sm font-medium">재계약 상담자</label><input type="text" name="salesperson" value={recontractForm.salesperson} onChange={handleRecontractFormChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div><div><label className="block text-sm font-medium">재계약 과정 기록</label><textarea name="content" value={recontractForm.content} onChange={handleRecontractFormChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required></textarea></div></div><div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowRecontractModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">저장 및 완료</button></div></form></div>}
      {/* showCommentModal removed as integrated into ConsultationModal */}
      {showConfirmDeleteModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50"><div className="p-8 bg-white w-full max-w-sm rounded-lg shadow-xl text-center"><h3 className="text-xl font-bold mb-4">기록 삭제</h3><p className="mb-6">정말로 삭제하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleDeleteRecord} className="px-4 py-2 bg-red-600 text-white rounded-md">삭제</button></div></div></div>}

      {
        showConsultationModal && selectedConsultationRecord && (
          <ConsultationModal
            record={selectedConsultationRecord}
            onClose={() => setShowConsultationModal(false)}
            onSave={handleSaveConsultation}
            reasons={reasons}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            newCommentText={newCommentText}
            setNewCommentText={setNewCommentText}

          />
        )
      }
      {
        showSaveSuccessModal && saveSuccessResult && (
          <SaveSuccessModal
            result={saveSuccessResult}
            onClose={() => {
              setShowSaveSuccessModal(false);
              setSaveSuccessResult(null);
            }}
          />
        )
      }
    </div >
  );
}
const PerformanceMetric = ({ label, value, pct, trend, onClick, color = 'blue', isZoomed = false }) => {
  const isUp = trend && trend.includes('+') && trend !== '+0%';
  const isDown = trend && trend.includes('-') && trend !== '-0%';

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer ${isZoomed ? 'p-6' : 'p-2.5'} rounded-2xl transition-all flex flex-col items-center border border-transparent hover:border-white/20 hover:bg-white/5 active:scale-95`}
    >
      <div className="flex flex-col items-center mb-1 w-full">
        <span className={`${isZoomed ? 'text-sm mb-1.5' : 'text-[9px] mb-0.5'} font-black opacity-40 uppercase tracking-tighter`}>{label}</span>
        {trend && (
          <span className={`${isZoomed ? 'text-[11px] px-2 py-1' : 'text-[8px] px-1 py-0.5'} font-black rounded-lg ${isUp ? 'bg-emerald-500/20 text-emerald-400' : isDown ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-0.5 justify-center">
        <span className={`${isZoomed ? 'text-5xl' : 'text-xl'} font-black group-hover:text-white transition-colors`}>{value}</span>
        <span className={`${isZoomed ? 'text-lg' : 'text-[10px]'} font-bold opacity-30`}>건</span>
      </div>
      {pct !== undefined && pct !== null && (
        <span className={`${isZoomed ? 'text-base mt-1' : 'text-[9px]'} font-black ${color === 'blue' ? 'text-blue-300' : 'text-rose-300'} opacity-60`}>{pct}%</span>
      )}
    </div>
  );
};

const SegmentContainer = ({ title, stats, trend, history, color = 'blue', onPrev, onNext, onMetricClick, onZoom, isZoomed = false, periodType }) => {
  const isBlue = color === 'blue';
  const isWeekly = periodType === 'week';

  // Weekly has lighter/different background for distinction, and no heavy shadow
  const bgClass = isBlue
    ? (isWeekly ? 'bg-blue-600/40 border-blue-500/30' : 'bg-indigo-900 border-indigo-800 shadow-2xl')
    : (isWeekly ? 'bg-rose-600/40 border-rose-500/30' : 'bg-rose-900 border-rose-800 shadow-2xl');

  return (
    <div className={`${isZoomed ? 'p-10' : 'p-4'} rounded-[2rem] border transition-all ${bgClass} text-white relative`}>
      <div className={`flex justify-between items-center ${isZoomed ? 'mb-8' : 'mb-3'} px-1`}>
        <div className="flex items-center gap-3">
          <h4 className={`${isZoomed ? 'text-2xl' : 'text-[12px]'} font-black opacity-90 flex items-center gap-1.5 cursor-pointer hover:text-white/80`} onClick={onZoom}>
            <span className={`${isZoomed ? 'w-2 h-6' : 'w-1 h-3'} rounded-full ${isWeekly ? 'bg-white/40' : 'bg-white'}`}></span>
            {title.replace('MONTHLY', '월간').replace('WEEKLY', '주간')}
            {!isZoomed && <Maximize2 className="w-3 h-3 opacity-40 ml-1" />}
          </h4>
        </div>
        <div className={`flex items-center ${isZoomed ? 'gap-4 px-4 py-1.5' : 'gap-1.5 px-2 py-0.5'} bg-black/20 rounded-lg border border-white/5`}>
          <button onClick={onPrev} className="hover:text-white/60"><ChevronLeft className={isZoomed ? "w-6 h-6" : "w-3.5 h-3.5"} /></button>
          <span className={`${isZoomed ? 'text-lg min-w-[120px]' : 'text-[10px] min-w-[65px]'} font-black text-center`}>{stats.label}</span>
          <button onClick={onNext} disabled={stats.isNow || stats.isFuture} className="hover:text-white/60 disabled:opacity-20"><ChevronRight className={isZoomed ? "w-6 h-6" : "w-3.5 h-3.5"} /></button>
        </div>
      </div>

      <div className={`${isZoomed ? 'grid grid-cols-4 gap-6' : 'grid grid-cols-4 gap-1'}`}>
        <PerformanceMetric
          label="총 DB건"
          value={stats.total}
          trend={trend.total}
          onClick={() => onMetricClick('total', periodType)}
          color={color}
          isZoomed={isZoomed}
        />
        <PerformanceMetric
          label="계약"
          value={stats.contracted}
          pct={stats.contractedPct}
          trend={trend.contracted}
          onClick={() => onMetricClick('계약', periodType)}
          color={color}
          isZoomed={isZoomed}
        />
        <PerformanceMetric
          label="미계약"
          value={stats.uncontracted}
          pct={stats.uncontractedPct}
          trend={trend.uncontracted}
          onClick={() => onMetricClick('미계약', periodType)}
          color={color}
          isZoomed={isZoomed}
        />
        <PerformanceMetric
          label="노쇼"
          value={stats.noshow}
          pct={stats.noshowPct}
          trend={trend.noshow}
          onClick={() => onMetricClick('노쇼', periodType)}
          color={color}
          isZoomed={isZoomed}
        />
      </div>

      {/* Mini Sparkline Trend Chart */}
      <SegmentTrendChart history={history} isZoomed={isZoomed} onClick={onZoom} />
    </div>
  );
};

const SegmentZoomModal = ({ type, dashboardData, onClose, onPrev, onNext, onMetricClick }) => {
  const segmentMap = {
    lureMonth: {
      title: '월간 루어',
      stats: dashboardData.lureMonthStats,
      trend: dashboardData.lureMonthTrend,
      history: dashboardData.lureMonthHistory,
      color: 'blue',
      periodType: 'month'
    },
    lureWeek: {
      title: '주간 루어',
      stats: dashboardData.lureWeekStats,
      trend: dashboardData.lureWeekTrend,
      history: dashboardData.lureWeekHistory,
      color: 'blue',
      periodType: 'week'
    },
    totalMonth: {
      title: '월간 통합',
      stats: dashboardData.totalMonthStats,
      trend: dashboardData.totalMonthTrend,
      history: dashboardData.totalMonthHistory,
      color: 'red',
      periodType: 'month'
    },
    totalWeek: {
      title: '주간 통합',
      stats: dashboardData.totalWeekStats,
      trend: dashboardData.totalWeekTrend,
      history: dashboardData.totalWeekHistory,
      color: 'red',
      periodType: 'week'
    }
  };

  const segment = segmentMap[type];
  if (!segment) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl animate-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all active:scale-95 shadow-lg group"
        >
          <X className="w-6 h-6 opacity-70 group-hover:opacity-100" />
        </button>
        <SegmentContainer
          {...segment}
          onPrev={onPrev}
          onNext={onNext}
          onMetricClick={onMetricClick}
          isZoomed={true}
        />
        <div className="mt-4 text-center text-white/40 text-xs font-black uppercase tracking-widest">
          배경을 클릭하거나 닫기 버튼을 누르면 돌아갑니다
        </div>
      </div>
    </div>
  );
};

const SegmentTrendChart = ({ history, isZoomed = false, onClick }) => {
  if (!history || history.length === 0) return null;

  const maxVal = Math.max(...history.map(h => h.total), 1);
  const chartHeight = isZoomed ? 200 : 60;
  const chartWidth = isZoomed ? 800 : 300;
  const paddingX = isZoomed ? 40 : 15;
  const paddingY = isZoomed ? 40 : 18;

  const getPoints = (key) => history.map((h, i) => {
    const x = (i / (history.length - 1)) * (chartWidth - paddingX * 2) + paddingX;
    const y = chartHeight - paddingY - (h[key] / maxVal) * (chartHeight - paddingY * 2);
    return `${x},${y}`;
  }).join(' ');

  const totalPoints = getPoints('total');
  const contractedPoints = getPoints('contracted');
  const uncontractedPoints = getPoints('uncontracted');

  return (
    <div
      className={`w-full ${isZoomed ? 'mt-8' : 'mt-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl'} px-1`}
      onClick={!isZoomed ? onClick : undefined}
    >
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Total DB Line (White) */}
        <polyline
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={isZoomed ? 3 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={totalPoints}
          className="opacity-20"
        />
        {/* Uncontracted Line (Red) */}
        <polyline
          fill="none"
          stroke="#EF4444"
          strokeWidth={isZoomed ? 3 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={uncontractedPoints}
          className="opacity-70"
        />
        {/* Contracted Line (Green) */}
        <polyline
          fill="none"
          stroke="#10B981"
          strokeWidth={isZoomed ? 3 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={contractedPoints}
          className="opacity-70"
        />

        {history.map((h, i) => {
          const x = (i / (history.length - 1)) * (chartWidth - paddingX * 2) + paddingX;
          const yTotal = chartHeight - paddingY - (h.total / maxVal) * (chartHeight - paddingY * 2);
          const yContracted = chartHeight - paddingY - (h.contracted / maxVal) * (chartHeight - paddingY * 2);
          const yUncontracted = chartHeight - paddingY - (h.uncontracted / maxVal) * (chartHeight - paddingY * 2);

          return (
            <g key={i}>
              {/* Markers */}
              <circle cx={x} cy={yTotal} r={isZoomed ? 4 : 1.5} fill="white" className="opacity-40" />
              <circle cx={x} cy={yContracted} r={isZoomed ? 4 : 1.5} fill="#10B981" className="opacity-80" />
              <circle cx={x} cy={yUncontracted} r={isZoomed ? 4 : 1.5} fill="#EF4444" className="opacity-80" />

              {/* Label (Total only) */}
              <text x={x} y={yTotal - (isZoomed ? 12 : 6)} textAnchor="middle" fontSize={isZoomed ? 12 : 7} fontWeight="black" fill="white" className="opacity-40">
                {h.total}
              </text>

              {/* Period Label */}
              <text x={x} y={chartHeight - (isZoomed ? 5 : 2)} textAnchor="middle" fontSize={isZoomed ? 11 : 6} fontWeight="bold" fill="white" className="opacity-20">
                {h.label.split(' ')[0]} {h.label.split(' ')[1]}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className={`flex justify-center ${isZoomed ? 'gap-8 mt-6' : 'gap-3 mt-1'} opacity-40 ${isZoomed ? 'text-[12px]' : 'text-[7px]'} font-black uppercase tracking-tighter`}>
        <div className="flex items-center gap-2"><div className={`bg-white ${isZoomed ? 'w-4 h-1' : 'w-1.5 h-0.5'}`}></div>DB (전체)</div>
        <div className="flex items-center gap-2"><div className={`bg-[#10B981] ${isZoomed ? 'w-4 h-1' : 'w-1.5 h-0.5'}`}></div>계약 성공</div>
        <div className="flex items-center gap-2"><div className={`bg-[#EF4444] ${isZoomed ? 'w-4 h-1' : 'w-1.5 h-0.5'}`}></div>미계약/기타</div>
      </div>
    </div>
  );
};

const DetailedDashboardList = ({ filter, records, onClose, onRecordClick, onExport }) => {
  const [isExpandingForPrint, setIsExpandingForPrint] = useState(false);
  const printRef = useRef(null);
  const filtered = records.filter(r => {
    if (filter.status === '계약') return r.status === '계약';
    if (filter.status === '미계약') return r.status === '미계약';
    if (filter.status === '노쇼') return r.status === '노쇼' || r.status === '미방문';
    return true;
  });

  return (
    <div className="mt-8 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in slide-in-from-top-6 duration-500" ref={printRef}>
      <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <span className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-full font-black uppercase mb-2 inline-block shadow-sm">Reporting Mode</span>
          <h3 className="text-2xl font-black text-gray-900 tracking-tighter">{filter.label} - {filter.status === 'total' ? '전체 DB' : filter.status} 상세 내역</h3>
          <p className="text-sm text-gray-400 font-bold mt-1">총 <span className="text-blue-600 underline font-black">{filtered.length}건</span>의 기록이 필터링되었습니다.</p>
        </div>
        <div className="flex gap-3 no-print">
          <button
            onClick={async () => {
              setIsExpandingForPrint(true);
              // Wait for React to re-render without the max-h constraint
              setTimeout(async () => {
                await onExport(printRef.current);
                setIsExpandingForPrint(false);
              }, 500);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-all shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4" /> A4 출력/PDF 저장
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className={isExpandingForPrint ? "" : "max-h-[600px] overflow-y-auto"}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 shadow-sm">
            <tr className="border-b border-gray-100">
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase">예약일 / 등록</th>
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase">고객명</th>
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase">유입 / 지점</th>
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase">상담자</th>
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase">상태</th>
              <th className="p-5 text-[11px] font-black text-gray-400 uppercase text-right">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(r => (
              <React.Fragment key={r.id}>
                <tr
                  onClick={() => onRecordClick(r)}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                >
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-700">{r.reservationDate}</span>
                      <span className="text-[10px] font-bold text-gray-400">{r.registrationDate || '-'}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <User className="w-4 h-4 text-gray-400 group-hover:text-white" />
                      </div>
                      <span className="text-sm font-black text-gray-800">{r.customerName}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-700">{r.source}</span>
                      <span className="text-[10px] font-black text-blue-500">{r.branch}</span>
                    </div>
                  </td>
                  <td className="p-5 text-sm font-bold text-gray-600">{r.salesperson || '-'}</td>
                  <td className="p-5">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${r.status === '계약' ? 'bg-blue-100 text-blue-700' :
                      r.status === '노쇼' || r.status === '미방문' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-5 text-right font-black text-gray-900 border-r border-gray-50">
                    {r.finalContractAmount ? `${Number(r.finalContractAmount).toLocaleString()}` : '-'}
                  </td>
                </tr>
                {/* Detail Summary Row (Only show during print/export) */}
                {isExpandingForPrint && (
                  <tr className="bg-gray-50/50 print-detail-row">
                    <td colSpan="6" className="p-0">
                      <div className="flex flex-col gap-6 px-10 py-6 border-b border-gray-100">
                        {/* 1. Final Result Section */}
                        {(r.contractAmount || r.consultationContent || r.reason) ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {r.status === '계약' ? (
                              <>
                                {r.contractAmount && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">계약 상세/메모</span>
                                    <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed">{r.contractAmount}</p>
                                  </div>
                                )}
                                {r.consultationContent && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">계약 과정</span>
                                    <p className="text-[11px] text-gray-500 whitespace-pre-wrap leading-relaxed italic">{r.consultationContent}</p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {r.reason && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">미계약 사유</span>
                                    <p className="text-[11px] text-gray-600 font-bold">{r.reason}</p>
                                  </div>
                                )}
                                {r.consultationContent && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">상담/조치 내용</span>
                                    <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed">{r.consultationContent}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic font-bold">등록된 상세 내용 없음</span>
                        )}

                        {/* 2. Full History Section */}
                        <div className="bg-white/50 p-4 rounded-xl border border-gray-100 shadow-sm">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-2 block">상담 히스토리 (상세 로그)</span>
                          <div className="space-y-3">
                            {[...(r.consultationLogs || []), ...(r.comments || []).map((c, i) => (typeof c === 'object' ? { ...c, isComment: true, index: i } : { text: c, isComment: true, index: i }))]
                              .sort((a, b) => {
                                const dA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.createdAt || a.timestamp || 0));
                                const dB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.createdAt || b.timestamp || 0));
                                return dB - dA;
                              })
                              .map((item, hIdx) => (
                                <div key={hIdx} className="border-l-2 border-gray-200 pl-3 py-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${item.isComment ? 'bg-amber-100 text-amber-700' : (item.type?.includes('계약') && !item.type?.includes('미') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}`}>
                                      {item.isComment ? 'COMMENT' : (item.type || 'LOG')}
                                    </span>
                                    <span className="text-[8px] text-gray-400 font-bold">
                                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('ko-KR') : (item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString('ko-KR') : '-')}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-600 leading-tight whitespace-pre-wrap">{item.text}</p>
                                </div>
                              ))}
                            {(!r.consultationLogs?.length && !r.comments?.length) && <p className="text-[10px] text-gray-300 italic">로그 기록 없음</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


const SaveSuccessModal = ({ result, onClose }) => {
  const handleCopyAndClose = () => {
    const info = `
[상담 결과]
상태: ${result.status === '계약' ? '계약완료' : result.status}
지점: ${result.branch}
상담자: ${result.salesperson || '미지정'}

${result.status === '계약' ? `최종결제금액: ${result.finalContractAmount ? Number(result.finalContractAmount).toLocaleString() : '0'}원
상세계약금액/메모:
${result.contractAmount || '-'}

계약과정 및 상담내용:
${result.consultationContent || '-'}` :
        result.status === '미계약' ? `미계약사유: ${result.reason || '-'}
상담/조치 내용:
${result.consultationContent || '-'}` :
          `상담 내용:
${result.consultationContent || '-'}`}
    `.trim();

    navigator.clipboard.writeText(info).then(() => {
      onClose();
    });
  };

  // Auto-copy on mount
  useEffect(() => {
    const info = `
[상담 결과]
상태: ${result.status === '계약' ? '계약완료' : result.status}
지점: ${result.branch}
상담자: ${result.salesperson || '미지정'}

${result.status === '계약' ? `최종결제금액: ${result.finalContractAmount ? Number(result.finalContractAmount).toLocaleString() : '0'}원
상세계약금액/메모:
${result.contractAmount || '-'}

계약과정 및 상담내용:
${result.consultationContent || '-'}` :
        result.status === '미계약' ? `미계약사유: ${result.reason || '-'}
상담/조치 내용:
${result.consultationContent || '-'}` :
          `상담 내용:
${result.consultationContent || '-'}`}
    `.trim();
    navigator.clipboard.writeText(info);
  }, [result]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black text-white">저장 및 복사 완료!</h3>
          <p className="text-blue-100 text-xs mt-1 font-bold">내용이 자동 복사되었습니다. 카톡에 붙여넣으세요.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm space-y-2">
            <div className="flex justify-between font-bold text-gray-400 text-[10px]">
              <span>[{result.branch}]</span>
              <span className={result.status === '계약' ? 'text-blue-600' : 'text-red-500'}>{result.status === '계약' ? '계약완료' : result.status}</span>
            </div>
            <div className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-2">{result.customerName} 고객님</div>
            <p className="text-gray-600 leading-relaxed text-[12px] whitespace-pre-wrap truncate max-h-[100px]">{result.contractAmount || result.consultationContent || '내용 없음'}</p>
          </div>
          <button
            onClick={handleCopyAndClose}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all active:scale-95"
          >
            확인 닫기 (자동복사됨)
          </button>
        </div>
      </div>
    </div>
  );
};


const renderChart = (data, ChartComponent) => {
  const hasData = Object.keys(data).length > 0;
  return (
    <div className="relative p-4">
      {hasData ? <ChartComponent data={data} /> : <p className="text-center text-gray-500 h-full flex items-center justify-center">데이터가 없습니다.</p>}
    </div>
  );
};

const MonthlyLineChart = ({ data }) => {
  const sortedMonths = data.map(d => d.month);
  if (sortedMonths.length === 0) return <div className="h-40 flex items-center justify-center text-gray-500">데이터가 없습니다.</div>;

  const maxCount = Math.max(...data.map(d => d.total), 0);
  const chartHeight = 240;
  const chartWidth = 700;
  const padding = 40;

  const points = data.map((monthData, index) => {
    const x = (index / (data.length > 1 ? data.length - 1 : 1)) * (chartWidth - padding * 2) + padding;
    const y = chartHeight - padding - ((monthData.total / (maxCount || 1)) * (chartHeight - padding * 2));
    return `${x},${y} `;
  }).join(' ');

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#e5e7eb" strokeWidth="1" />
        <polyline fill="none" stroke="#EF4444" strokeWidth="2" points={points} />
        {data.map((monthData, index) => {
          const x = (index / (data.length > 1 ? data.length - 1 : 1)) * (chartWidth - padding * 2) + padding;
          const y = chartHeight - padding - ((monthData.total / (maxCount || 1)) * (chartHeight - padding * 2));
          return (
            <g key={monthData.month}>
              <circle cx={x} cy={y} r="4" fill="#EF4444" stroke="white" strokeWidth="2" />
              <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill="#EF4444" fontWeight="black">{monthData.total}</text>
              <text x={x} y={chartHeight - padding + 15} textAnchor="middle" fontSize="10" fill="#9ca3af" fontWeight="bold">
                {parseInt(monthData.month.split('-')[1])}월
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const MatrixTable = ({ data, title, onRowClick }) => {
  if (!Array.isArray(data) || data.length === 0 || !data[0]) return <div className="p-4 text-center text-gray-400">데이터가 없습니다.</div>;
  const headers = Object.keys(data[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {headers.map(h => <th key={h} className="p-2 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row, idx) => (
            <tr key={idx} onClick={() => onRowClick && onRowClick(row[title])} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
              {headers.map(h => (
                <td key={h} className={`p-2 text-xs ${h === title ? 'font-black text-gray-800' : 'font-medium text-gray-500'}`}>
                  {typeof row[h] === 'number' ? (h.includes('%') ? `${row[h]}%` : row[h].toLocaleString()) : row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const VerticalComparisonBarChart = ({ currentData, prevData, twoMonthsAgoData, colors, mapLabelToColor }) => {
  const allKeys = Array.from(new Set([
    ...Object.keys(currentData),
    ...Object.keys(prevData),
    ...(twoMonthsAgoData ? Object.keys(twoMonthsAgoData) : [])
  ]));
  allKeys.sort((a, b) => (currentData[b] || 0) - (currentData[a] || 0));

  const maxCount = Math.max(
    ...allKeys.map(k => Math.max(
      currentData[k] || 0,
      prevData[k] || 0,
      twoMonthsAgoData ? twoMonthsAgoData[k] || 0 : 0
    )), 1
  );

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex space-x-8 min-w-max px-4 items-end h-64 pt-10">
        {allKeys.length === 0 && <div className="text-gray-400 text-sm m-auto">데이터 없음</div>}
        {allKeys.map(label => {
          const curr = currentData[label] || 0;
          const prev = prevData[label] || 0;
          const twoAgo = twoMonthsAgoData ? (twoMonthsAgoData[label] || 0) : 0;
          const color = mapLabelToColor ? mapLabelToColor(label) : (colors[label] || '#9CA3AF');

          return (
            <div key={label} className="flex flex-col items-center group">
              <div className="flex items-end space-x-1 h-48 border-b border-gray-300 pb-1">
                {twoMonthsAgoData && (
                  <div className="w-5 bg-gray-100 rounded-t-sm relative transition-all duration-300" style={{ height: `${(twoAgo / maxCount) * 100}%` }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold">{twoAgo}</span>
                  </div>
                )}
                <div className="w-5 bg-gray-300 rounded-t-sm relative transition-all duration-300" style={{ height: `${(prev / maxCount) * 100}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold">{prev}</span>
                </div>
                <div className="w-5 rounded-t-sm relative transition-all duration-300 shadow-sm" style={{ height: `${(curr / maxCount) * 100}%`, backgroundColor: color }}>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] text-black font-black whitespace-nowrap">{curr}</span>
                </div>
              </div>
              <span className="text-[12px] font-black text-gray-700 mt-2 truncate w-20 text-center">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-6 mt-4 text-[10px] text-gray-400 font-black uppercase">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-gray-100 rounded-full"></div>2달 전</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-gray-300 rounded-full"></div>지난달</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-current rounded-full" style={{ color: '#444' }}></div>이번달</div>
      </div>
    </div>
  );
};

const SalespersonTrendSection = ({ trendData, targetMonths, salespersonSearch, setSalespersonSearch }) => {
  const m2 = targetMonths[0]; // 2 months ago
  const m1 = targetMonths[1]; // 1 month ago
  const m0 = targetMonths[2]; // Current month

  const renderStatusTrendGroup = (title, icon, barColor, getDataFn) => {
    const filteredAndSortedSalespersons = Object.keys(trendData)
      .filter(sp => sp.toLowerCase().includes(salespersonSearch.toLowerCase()))
      .sort((a, b) => {
        const perfA = trendData[a][m0] ? getDataFn(trendData[a][m0]) : 0;
        const perfB = trendData[b][m0] ? getDataFn(trendData[b][m0]) : 0;
        return perfB - perfA;
      });

    let globalMax = 10; // Floor of 10 to ensure better scaling for small numbers
    filteredAndSortedSalespersons.forEach(sp => {
      const val0 = trendData[sp][m0] ? getDataFn(trendData[sp][m0]) : 0;
      const val1 = trendData[sp][m1] ? getDataFn(trendData[sp][m1]) : 0;
      const val2 = trendData[sp][m2] ? getDataFn(trendData[sp][m2]) : 0;
      globalMax = Math.max(globalMax, val0, val1, val2);
    });

    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-2">
            {icon}
            <h5 className="text-[13px] font-black text-gray-700">{title} (3개월 추이)</h5>
          </div>
          <div className="flex gap-2 text-[9px] font-black uppercase text-gray-400">
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-gray-100 rounded-full"></div>2달전</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>지난달</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: barColor }}></div>이번달</span>
          </div>
        </div>
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-8 min-w-max px-2 items-end h-32 pt-6">
            {filteredAndSortedSalespersons.length === 0 ? (
              <div className="w-full text-center text-gray-300 text-xs py-10 font-bold">데이터가 없습니다.</div>
            ) : (
              filteredAndSortedSalespersons.map(sp => {
                const d0 = trendData[sp][m0] ? getDataFn(trendData[sp][m0]) : 0;
                const d1 = trendData[sp][m1] ? getDataFn(trendData[sp][m1]) : 0;
                const d2 = trendData[sp][m2] ? getDataFn(trendData[sp][m2]) : 0;
                return (
                  <div key={sp} className="flex flex-col items-center min-w-[60px]">
                    <div className="flex items-end gap-1 h-16 mb-1">
                      <div className="relative flex flex-col items-center justify-end h-full">
                        <div style={{ height: `${d2 > 0 ? Math.max(8, (d2 / globalMax) * 100) : 0}%` }} className="w-3.5 bg-gray-100 rounded-t-[2px] border-x border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex flex-col items-center justify-end h-full">
                        <div style={{ height: `${d1 > 0 ? Math.max(8, (d1 / globalMax) * 100) : 0}%` }} className="w-3.5 bg-gray-300 rounded-t-[2px] border-x border-t border-gray-400"></div>
                      </div>
                      <div className="relative flex flex-col items-center justify-end h-full">
                        <div style={{ height: `${d0 > 0 ? Math.max(8, (d0 / globalMax) * 100) : 0}%`, backgroundColor: barColor }} className="w-3.5 rounded-t-[2px] shadow-sm border-x border-t border-black/5"></div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 text-[9px] font-black mb-1.5">
                      <span className="text-gray-400 w-3.5 text-center">{d2}</span>
                      <span className="text-gray-500 w-3.5 text-center">{d1}</span>
                      <span className="text-gray-900 w-3.5 text-center">{d0}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-600 w-16 text-center leading-tight">{sp}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50/50 p-4 rounded-3xl border border-gray-100 mb-6">
        <h4 className="text-[16px] font-black text-gray-800 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          상담자별 실적 추이
        </h4>
        <div className="relative w-full md:w-64 mt-4 md:mt-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="상담자 이름 검색..."
            value={salespersonSearch}
            onChange={(e) => setSalespersonSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {renderStatusTrendGroup("미계약", <X className="w-4 h-4 text-rose-400" />, "#fb7185", (s) => s.uncontract || 0)}
        {renderStatusTrendGroup("재계약", <RefreshCcw className="w-4 h-4 text-emerald-500" />, "#10b981", (s) => s.recovery || 0)}
        {renderStatusTrendGroup("신규계약", <Plus className="w-4 h-4 text-blue-500" />, "#3b82f6", (s) => s.contract || 0)}
      </div>
    </div>
  );
};

// --- Utility Functions ---
const formatWithCommas = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const num = val.toString().replace(/[^0-9]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const unformatCommas = (val) => {
  if (!val) return '';
  return val.toString().replace(/,/g, '');
};

const ConsultationModal = ({ record, onClose, onSave, reasons, onAddComment, onDeleteComment, newCommentText, setNewCommentText }) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (record) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [record]);
  const [status, setStatus] = useState((record.status === '대기' || !record.status) ? '계약' : record.status);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [isAddingContent, setIsAddingContent] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: record.customerName || '',
    customerContact: record.customerContact || '',
    reservationDate: record.reservationDate || '',
    reservationTime: record.reservationTime || '',
    salesperson: record.salesperson || '',
  });

  const [formData, setFormData] = useState({
    contractAmount: record.contractAmount || '',
    finalContractAmount: record.finalContractAmount || '',
    consultationContent: record.consultationContent || '',
    reason: record.reason || '',
    memo: record.memo || '',
    noShowContactDate: record.noShowContactDate || '',
    noShowContactTime: record.noShowContactTime || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'finalContractAmount' || name === 'contractAmount') {
      setFormData(prev => ({ ...prev, [name]: unformatCommas(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  const handleCustomerChange = (e) => setCustomerInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = () => {
    onSave(record.id, {
      ...formData,
      ...customerInfo,
      status
    });
  };

  const handleCopyAllInfo = () => {
    const info = `
[상담 결과]
상태: ${status === '계약' ? '계약완료' : status}
지점: ${record.branch}
상담자: ${record.salesperson || '미지정'}

${status === '계약' ? `최종결제금액: ${formatWithCommas(formData.finalContractAmount)}원
상세계약금액/메모:
${formData.contractAmount || '-'}

계약과정 및 상담내용:
${formData.consultationContent || '-'}` :
        status === '미계약' ? `미계약사유: ${formData.reason || '-'}
상담/조치 내용:
${formData.consultationContent || '-'}` :
          `상담 내용:
${formData.consultationContent || '-'}`}
    `.trim();

    navigator.clipboard.writeText(info).then(() => {
      alert("전체 내용이 복사되었습니다.");
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">상담 처리</h3>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">상담 고객 정보</span>
              <button onClick={() => setIsEditingInfo(!isEditingInfo)} className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors">
                {isEditingInfo ? '편집 취소' : '정보 수정'}
              </button>
            </div>

            {isEditingInfo ? (
              <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[10px] text-gray-400 mb-1 ml-1 font-bold">고객명</label>
                    <input name="customerName" value={customerInfo.customerName} onChange={handleCustomerChange} className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] text-gray-400 mb-1 ml-1 font-bold">연락처</label>
                    <input name="customerContact" value={customerInfo.customerContact} onChange={handleCustomerChange} className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 ml-1 font-bold">예약일</label>
                    <input type="date" name="reservationDate" value={customerInfo.reservationDate} onChange={handleCustomerChange} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 ml-1 font-bold">시간</label>
                    <input type="time" name="reservationTime" value={customerInfo.reservationTime} onChange={handleCustomerChange} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <label className="block text-[10px] text-gray-400 mb-1 ml-1 font-bold">상담자</label>
                  <input name="salesperson" value={customerInfo.salesperson} onChange={handleCustomerChange} className="w-full p-2 border border-blue-100 rounded-lg text-sm font-black text-blue-700 bg-blue-50/30" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-end gap-2">
                  <span className="font-black text-2xl text-gray-800 tracking-tighter">{customerInfo.customerName}</span>
                  <span className="text-sm font-bold text-gray-400 mb-1">{customerInfo.customerContact}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center text-xs font-bold text-gray-500">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-blue-500" />
                    {customerInfo.reservationDate} {customerInfo.reservationTime}
                  </div>
                  <div className="flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <User className="w-3 h-3 mr-1" />
                    상담자: {customerInfo.salesperson || '미지정'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Final Consultation Result Display Section */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 font-sans">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded uppercase tracking-wider">최종 상담 결과</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${status === '계약' ? 'bg-blue-600 text-white' : status === '미계약' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
                {status}
              </span>
            </div>

            {status === '계약' && (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2">
                  <span className="text-xs font-bold text-gray-400">최종결제금액</span>
                  <span className="text-lg font-black text-blue-600">{formatWithCommas(formData.finalContractAmount)}원</span>
                </div>

                {formData.contractAmount && (
                  <div>
                    <span className="block text-[10px] font-black text-gray-400 mb-1">상세 계약금액/메모</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner font-medium">
                      {formData.contractAmount}
                    </div>
                  </div>
                )}

                {formData.consultationContent && (
                  <div>
                    <span className="block text-[10px] font-black text-gray-400 mb-1">계약과정 및 상담내용</span>
                    <div className="bg-white/50 p-3 rounded-xl border border-gray-100 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
                      {formData.consultationContent}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === '미계약' && (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2">
                  <span className="text-xs font-bold text-gray-400">미계약 사유</span>
                  <span className="text-sm font-black text-red-600">{formData.reason || '사유 미입력'}</span>
                </div>
                {formData.consultationContent && (
                  <div>
                    <span className="block text-[10px] font-black text-gray-400 mb-1">상담/조치 내용</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {formData.consultationContent}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(status === '노쇼' || status === '미방문') && (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2">
                  <span className="text-xs font-bold text-gray-400">컨택 일시</span>
                  <span className="text-sm font-black text-gray-700">{formData.noShowContactDate} {formData.noShowContactTime}</span>
                </div>
                {formData.consultationContent && (
                  <div>
                    <span className="block text-[10px] font-black text-gray-400 mb-1">노쇼 사유 / 메모</span>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {formData.consultationContent}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!formData.finalContractAmount && !formData.contractAmount && !formData.consultationContent && !formData.reason) && (
              <div className="py-4 text-center text-xs font-bold text-gray-300 italic">
                등록된 상세 상담 결과가 없습니다.
              </div>
            )}
          </div>

          <div className="bg-white">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-black text-gray-600">상담 히스토리</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-400 font-bold border border-gray-200">
                  {(record.consultationLogs?.length || 0) + (record.comments?.length || 0)}건
                </span>
              </div>
              {isHistoryExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />}
            </button>

            {isHistoryExpanded && (
              <div className="mt-2 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar animate-in slide-in-from-top-2 duration-300">
                {[...(record.consultationLogs || []), ...(record.comments || []).map((c, i) => (typeof c === 'object' ? { ...c, isComment: true, index: i } : { text: c, isComment: true, index: i }))]
                  .sort((a, b) => {
                    const dA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.createdAt || a.timestamp || 0));
                    const dB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.createdAt || b.timestamp || 0));
                    return dB - dA;
                  })
                  .map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border group relative ${item.isComment ? 'bg-amber-50/50 border-amber-100' : (item.type?.includes('계약') && !item.type?.includes('미') ? 'bg-blue-50/50 border-blue-100' : 'bg-red-50/50 border-red-100')}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.isComment ? 'bg-amber-100 text-amber-700' : (item.type?.includes('계약') && !item.type?.includes('미') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}`}>
                          {item.isComment ? 'COMMENT' : (item.type || 'LOG')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('ko-KR') : (item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString('ko-KR') : '-')}
                          </span>
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                <button
                  onClick={handleCopyAllInfo}
                  className="w-full py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-white hover:text-blue-600 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <Copy className="w-3.5 h-3.5" /> 전체 히스토리 복사
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            {!isAddingContent && !isEditingInfo ? (
              <button
                onClick={() => setIsAddingContent(true)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> 내용 추가 (상태 변경 및 상담 작성)
              </button>
            ) : isAddingContent ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-gray-800">상담 내용 및 상태 업데이트</h4>
                  <button onClick={() => setIsAddingContent(false)} className="text-xs font-bold text-gray-400 hover:text-red-500">닫기</button>
                </div>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1 mb-4">
                  {['계약', '미계약', '노쇼'].map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${status === s ?
                        (s === '계약' ? 'bg-white text-blue-600 shadow-md transform scale-105' : s === '미계약' ? 'bg-white text-red-600 shadow-md transform scale-105' : 'bg-white text-gray-800 shadow-md transform scale-105')
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                        }`}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 font-sans">
                  {status === '계약' && (
                    <div className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-1">최종결제금액 (순위정산용) 단위:원</label>
                        <input type="text" name="finalContractAmount" value={formatWithCommas(formData.finalContractAmount)} onChange={handleChange} className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="원화단위 입력 예) 990,000" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-1">상세 계약금액/메모</label>
                        <textarea
                          name="contractAmount"
                          value={formData.contractAmount}
                          onChange={handleChange}
                          rows="6"
                          className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm leading-relaxed"
                          placeholder={`예) 하드 (219) 조끼 (40)\n기성대체  (30)\n정장1 조끼1 셔츠2 구두1 대여2\n총 289(28,9)-317,9\n박 30\n계 287,9\n잔 x`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-1">계약과정 및 상담내용 작성</label>
                        <textarea
                          name="consultationContent"
                          value={formData.consultationContent}
                          onChange={handleChange}
                          rows="4"
                          className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="예) 상담내용 + 체촌여부 + 상담시간 + 반도진행 여부 등"
                        />
                      </div>
                    </div>
                  )}

                  {status === '미계약' && (
                    <div className="space-y-3 bg-red-50 p-4 rounded-xl border border-red-100">
                      <div>
                        <label className="block text-sm font-semibold text-red-900 mb-1">미계약 사유</label>
                        <select name="reason" value={formData.reason} onChange={handleChange} className="w-full p-3 border border-red-200 rounded-lg bg-white focus:ring-2 focus:ring-red-500 outline-none">
                          <option value="">사유 선택</option>
                          {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-red-900 mb-1">상담/조치 내용</label>
                                                <textarea name="consultationContent" value={formData.consultationContent} onChange={handleChange} rows="3" className="w-full p-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="예)상담시간 60분 등"></textarea>
                      </div>
                    </div>
                  )}

                  {(status === '노쇼' || status === '미방문') && (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">컨택 날짜</label>
                          <input type="date" name="noShowContactDate" value={formData.noShowContactDate} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">시간</label>
                          <input type="time" name="noShowContactTime" value={formData.noShowContactTime} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">노쇼 사유 / 메모</label>
                        <textarea name="consultationContent" value={formData.consultationContent} onChange={handleChange} rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 outline-none" placeholder="예)상담시간 60분 등"></textarea>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  rows="2"
                  placeholder="관리자 코멘트를 입력하세요..."
                  className="w-full p-2 text-sm border-0 bg-transparent focus:ring-0 outline-none resize-none font-sans"
                ></textarea>
                <div className="flex justify-end pt-2 border-t border-gray-200 mt-2">
                  <button onClick={onAddComment} className="px-4 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors">코멘트 등록</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-3 text-sm bg-white border border-gray-300 rounded-xl font-black text-gray-600 hover:bg-gray-50 transition-colors">닫기</button>
          {(isAddingContent || isEditingInfo) && (
            <button onClick={handleSubmit} className={`flex-[2] py-4 text-sm text-white rounded-xl font-black shadow-xl transition-all active:scale-95 ${status === '계약' ? 'bg-blue-600 hover:bg-blue-700' :
              status === '미계약' ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-gray-800'
              }`}>
              {status === '계약' ? '계약 완료 및 등록' : status === '미계약' ? '미계약 건 등록' : '노쇼(미방문) 등록'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PaginatedTable = ({ title, records, currentPage, setCurrentPage, columns, renderRow, recordsPerPage = 10 }) => {
  const totalPages = Math.ceil(records.length / recordsPerPage);
  const paginatedRecords = records.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  return (
    <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-lg border border-gray-100">
      {title && <h2 className="text-lg font-black mb-3 text-gray-700">{title}</h2>}
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full divide-y divide-gray-100 table-fixed">
          <thead className="bg-gray-50/50">
            <tr>
              {columns.map((col) => <th key={col} className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{col}</th>)}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {records.length === 0 ? (
              <tr><td colSpan={columns.length} className="p-4 text-center text-gray-500 font-bold text-sm">해당 기록이 없습니다.</td></tr>
            ) : (
              paginatedRecords.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-3 space-x-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-xl disabled:opacity-20 hover:bg-gray-100 transition-all"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[11px] font-black text-gray-400">페이지 {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-xl disabled:opacity-20 hover:bg-gray-100 transition-all"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

function BranchScheduleEditor({ branch, db, onBack }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allSchedules, setAllSchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);

  const defaultTimes = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

  useEffect(() => {
    if (!db || !branch) return;
    const q = query(collection(db, `artifacts/${appId}/public/data/fair_schedules`), where("branchName", "==", branch));
    const unsub = onSnapshot(q, (snapshot) => {
      const mapped = {};
      snapshot.docs.forEach(doc => { mapped[doc.data().date] = doc.data(); });
      setAllSchedules(mapped);
    });
    return () => unsub();
  }, [db, branch]);

  const activeSchedule = selectedDate ? allSchedules[selectedDate] : null;

  useEffect(() => {
    if (selectedDate) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedDate]);

  const totalAvailableCount = useMemo(() => {
    if (!selectedDate) return 0;
    return defaultTimes.reduce((acc, time) => {
      const slot = allSchedules[selectedDate]?.slots?.find(s => s.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [] };
      const totalStaff = allSchedules[selectedDate]?.totalDbCount || 3;
      const bookedCount = slot.booked || 0;
      const disabledIndices = slot.disabledIndices || [];
      let count = 0;
      for (let i = 0; i < totalStaff; i++) {
        if (!disabledIndices.includes(i) && i >= bookedCount) count++;
      }
      return acc + count;
    }, 0);
  }, [selectedDate, allSchedules]);

  const handleSaveDay = async (date, updatedSchedule) => {
    try {
      const scheduleId = `${branch}_${date}`;
      const docRef = doc(db, `artifacts/${appId}/public/data/fair_schedules`, scheduleId);
      await setDoc(docRef, { ...updatedSchedule, branchName: branch, date, updatedAt: new Date() });
    } catch (e) { console.error(e); }
  };

  const toggleIndividualSlot = async (date, time, slotIndex) => {
    const existing = allSchedules[date] || { date, branchName: branch, totalDbCount: 3, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
    const newSlots = existing.slots.map(s => {
      if (s.time === time) {
        const disabled = s.disabledIndices || [];
        const newDisabled = disabled.includes(slotIndex) ? disabled.filter(i => i !== slotIndex) : [...disabled, slotIndex];
        return { ...s, disabledIndices: newDisabled };
      }
      return s;
    });
    const updated = { ...existing, slots: newSlots };
    setAllSchedules(prev => ({ ...prev, [date]: updated }));
    handleSaveDay(date, updated);
  };

  const updateAllCapacities = async (date, count) => {
    const existing = allSchedules[date] || { date, branchName: branch, totalDbCount: count, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
    const newDisabledIndices = [];
    if (count < 3) newDisabledIndices.push(2);
    if (count < 2) newDisabledIndices.push(1);
    const newSlots = defaultTimes.map(time => {
      const s = existing.slots?.find(sl => sl.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [] };
      return { ...s, disabledIndices: [...newDisabledIndices] };
    });
    const updated = { ...existing, totalDbCount: count, slots: newSlots };
    setAllSchedules(prev => ({ ...prev, [date]: updated }));
    handleSaveDay(date, updated);
  };

  const closeWholeDay = async (date) => {
    const existing = allSchedules[date] || { date, branchName: branch, totalDbCount: 3, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
    const newSlots = defaultTimes.map(time => {
      const s = existing.slots?.find(sl => sl.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [] };
      return { ...s, disabledIndices: [0, 1, 2] };
    });
    const updated = { ...existing, slots: newSlots };
    setAllSchedules(prev => ({ ...prev, [date]: updated }));
    handleSaveDay(date, updated);
  };

  const openWholeDay = async (date) => {
    const existing = allSchedules[date] || { date, branchName: branch, totalDbCount: 3, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
    const count = existing.totalDbCount || 3;
    const defaultDisabled = [];
    if (count < 3) defaultDisabled.push(2);
    if (count < 2) defaultDisabled.push(1);
    const newSlots = defaultTimes.map(time => {
      const s = existing.slots?.find(sl => sl.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [] };
      return { ...s, disabledIndices: [...defaultDisabled] };
    });
    const updated = { ...existing, slots: newSlots };
    setAllSchedules(prev => ({ ...prev, [date]: updated }));
    handleSaveDay(date, updated);
  };

  const toggleSlot = async (date, time) => {
    const existing = allSchedules[date] || { date, branchName: branch, totalDbCount: 3, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
    const targetSlot = existing.slots.find(s => s.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [0, 1, 2] };
    const isOpen = !((targetSlot.disabledIndices || []).length === 3);
    const newSlots = defaultTimes.map(timeStr => {
      const s = existing.slots.find(sl => sl.time === timeStr) || { time: timeStr, capacity: 3, booked: 0, disabledIndices: [0, 1, 2] };
      if (timeStr === time) {
        if (isOpen) return { ...s, disabledIndices: [0, 1, 2] };
        else {
          const count = existing.totalDbCount || 3;
          const restored = [];
          if (count < 3) restored.push(2);
          if (count < 2) restored.push(1);
          return { ...s, disabledIndices: restored };
        }
      }
      return s;
    });
    const updated = { ...existing, slots: newSlots };
    setAllSchedules(prev => ({ ...prev, [date]: updated }));
    handleSaveDay(date, updated);
  };

  const navigateDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const ds = d.toISOString().split('T')[0];
    if (d.getMonth() !== currentMonth.getMonth()) setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(ds);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay || 7) - 1; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {['월', '화', '수', '목', '금', '토', '일'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-300 p-2 uppercase">{d}</div>
        ))}
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-28 sm:h-32 bg-slate-50/30 rounded-2xl" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const schedule = allSchedules[dateStr];
          const hasSlots = schedule?.slots?.length > 0;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          return (
            <button key={day} onClick={() => setSelectedDate(dateStr)} className={`h-28 sm:h-32 rounded-2xl border transition-all flex flex-col p-3 text-left group overflow-hidden ${isToday ? 'border-amber-400 ring-1 ring-amber-400 bg-white' : hasSlots ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'} hover:border-emerald-400 hover:bg-white hover:shadow-lg active:scale-95`}>
              <span className={`text-xs font-black ${isToday ? 'text-amber-600' : 'text-slate-700'}`}>{day}</span>
              {hasSlots && (
                <div className="mt-1.5 flex-1 overflow-hidden flex flex-col justify-between">
                  <div className="space-y-[1px]">
                    {schedule.slots.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-0.5 leading-none">
                        <span className="text-[6px] font-black text-slate-300 scale-90 origin-left">{s.time.split(':')[0]}</span>
                        <div className="flex gap-[0.5px]">
                          {(() => {
                            const totalStaff = schedule.totalDbCount || 3;
                            const slots = [];
                            for (let dotIdx = 0; dotIdx < 3; dotIdx++) {
                              const isOutOfStaff = dotIdx >= totalStaff;
                              const isDisabled = (s.disabledIndices || []).includes(dotIdx);
                              const isBooked = dotIdx < (s.booked || 0);
                              if (!isOutOfStaff && !isDisabled) slots.push({ type: 'open', booked: isBooked });
                            }
                            return (
                              <div className="flex gap-[0.5px]">
                                {slots.map((sl, idx) => (
                                  <div key={idx} className={`w-[4px] h-[4px] rounded-full ${sl.booked ? 'bg-slate-300' : 'bg-emerald-400'}`} />
                                ))}
                                {Array.from({ length: totalStaff - slots.length }).map((_, idx) => (
                                  <div key={idx} className="w-[3px] h-[1px] bg-slate-200 rounded-full my-auto" />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 sm:p-8">
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{branch}</div>
                  <h3 className="text-2xl font-black text-slate-800">{selectedDate.replace(/-/g, '. ')}.</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-tight">당일 가능 상담 개수 {totalAvailableCount}개</span>
                  </div>
                </div>
                <button onClick={() => navigateDate(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-6 mb-8 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">동시간대 상담가능 개수 설정</div>
                    <div className="text-2xl font-black text-slate-800">{activeSchedule?.totalDbCount || 3}개 설정</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateAllCapacities(selectedDate, Math.max(1, (activeSchedule?.totalDbCount || 3) - 1))} className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-400 hover:text-emerald-600 hover:border-emerald-200"><ChevronDown className="w-6 h-6" /></button>
                    <button onClick={() => updateAllCapacities(selectedDate, Math.min(3, (activeSchedule?.totalDbCount || 3) + 1))} className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm active:scale-90 transition-all text-slate-400 hover:text-emerald-600 hover:border-emerald-200"><ChevronUp className="w-6 h-6" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => closeWholeDay(selectedDate)} className="py-4 bg-white border border-rose-100 text-rose-500 rounded-2xl font-black text-xs hover:bg-rose-50 transition-all flex items-center justify-center gap-2 shadow-sm"><XCircle className="w-4 h-4" /> 전체 마감</button>
                  <button onClick={() => openWholeDay(selectedDate)} className="py-4 bg-white border border-emerald-100 text-emerald-600 rounded-2xl font-black text-xs hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-sm"><CheckCircle2 className="w-4 h-4" /> 전체 열기</button>
                </div>
              </div>

              <div className="space-y-4">
                {defaultTimes.map(time => {
                  const slot = activeSchedule?.slots?.find(s => s.time === time) || { time, capacity: 3, booked: 0, disabledIndices: [] };
                  const isOpen = !((slot.disabledIndices || []).length === 3);
                  const bookedCount = slot.booked || 0;
                  const avail = (activeSchedule?.totalDbCount || 3) - (slot.disabledIndices?.length || 0);

                  return (
                    <div key={time} className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col gap-4 ${isOpen ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-slate-100/80 opacity-60'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-3 flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`text-xl font-black ${isOpen ? 'text-emerald-900' : 'text-slate-400'}`}>{time}</div>
                            <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                              {bookedCount > 0 ? `기존 ${bookedCount}건 예약됨` : `${avail}개 가능`}
                            </div>
                            {bookedCount > 0 && <div className="text-[9px] font-bold text-amber-500 flex items-center gap-1 animate-pulse"><div className="w-1 h-1 rounded-full bg-amber-500" /> 보호됨</div>}
                          </div>
                          <div className="flex flex-wrap gap-2.5">
                            {(() => {
                              const staff = activeSchedule?.totalDbCount || 3;
                              const active = [];
                              const closed = [];
                              const hidden = [];
                              for (let i = 0; i < 3; i++) {
                                const isB = i < bookedCount;
                                const isD = (slot.disabledIndices || []).includes(i);
                                const isH = i >= staff;
                                if (isH) hidden.push(i);
                                else if (isD) closed.push(i);
                                else active.push({ index: i, booked: isB });
                              }
                              return (
                                <>
                                  {active.map((as, idx) => (
                                    <button key={`act-${idx}`} disabled={as.booked} onClick={() => toggleIndividualSlot(selectedDate, time, as.index)} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all active:scale-90 shadow-md ${as.booked ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>{idx + 1}</button>
                                  ))}
                                  {closed.map((cs, idx) => (
                                    <button key={`cls-${idx}`} onClick={() => toggleIndividualSlot(selectedDate, time, cs)} className="px-5 h-12 bg-white border-2 border-slate-200 text-slate-400 rounded-2xl text-xs font-black hover:border-emerald-200 transition-all flex items-center justify-center">마감</button>
                                  ))}
                                  {hidden.map((os, idx) => (
                                    <div key={`hid-${idx}`} className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center opacity-20"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full" /></div>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <button onClick={() => toggleSlot(selectedDate, time)} disabled={bookedCount > 0} className={`px-4 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 whitespace-nowrap ${bookedCount > 0 ? 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-100' : isOpen ? 'bg-white text-rose-500 border-2 border-rose-100 hover:bg-rose-50 shadow-sm' : 'bg-slate-800 text-white shadow-lg hover:bg-black'}`}>{bookedCount > 0 ? '수정 불가' : isOpen ? '시간 마감' : '시간 열기'}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => {
                  if (selectedDate) {
                    const existing = allSchedules[selectedDate] || { date: selectedDate, branchName: branch, totalDbCount: 3, slots: defaultTimes.map(t => ({ time: t, capacity: 3, booked: 0, disabledIndices: [] })) };
                    handleSaveDay(selectedDate, existing);
                  }
                  setSelectedDate(null);
                }} 
                className="w-full py-5 bg-slate-800 text-white rounded-[2rem] font-black shadow-xl hover:bg-black transition-all"
              >
                설정 저장 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-800 rounded-2xl shadow-xl"><Settings className="text-white w-8 h-8" /></div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{branch} 일정 설정</h2>
              <p className="text-slate-400 font-bold text-sm">상담 가능 시간을 활성화하고 동그라미(개수)를 설정하세요.</p>
            </div>
          </div>
          <button onClick={onBack} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all"><Undo2 className="w-6 h-6 text-slate-400" /></button>
        </header>

        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all"><ChevronRight className="w-6 h-6 text-slate-600" /></button>
            </div>
          </div>
          {renderCalendar()}
        </div>
      </div>
    </div>
  );
}

function FairScheduleViewer({ fairUser, branches, db, onBack }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState(branches[0]);
  const [branchSchedules, setBranchSchedules] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [now, setNow] = useState(new Date());
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false);
  const [allGlobalSchedules, setAllGlobalSchedules] = useState([]);

  useEffect(() => {
    if (!db) return;
    const q = collection(db, `artifacts/${appId}/public/data/fair_schedules`);
    const unsub = onSnapshot(q, (snapshot) => {
      setAllGlobalSchedules(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsub();
  }, [db]);

  const myBookings = useMemo(() => {
    const list = [];
    allGlobalSchedules.forEach(sched => {
      (sched.bookings || []).forEach(b => {
        if (b.userId === fairUser.phone) list.push({ ...b, date: sched.date, branchName: sched.branchName });
      });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [allGlobalSchedules, fairUser.phone]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedDate || isMyBookingsOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedDate, isMyBookingsOpen]);

  useEffect(() => {
    if (!db || !selectedBranch) return;
    setLoading(true);
    const q = query(collection(db, `artifacts/${appId}/public/data/fair_schedules`), where("branchName", "==", selectedBranch));
    const unsub = onSnapshot(q, (snapshot) => {
      const schedules = {};
      snapshot.docs.forEach(doc => { schedules[doc.data().date] = doc.data(); });
      setBranchSchedules(schedules);
      setLoading(false);
    });
    return () => unsub();
  }, [db, selectedBranch]);

  const activeSchedule = selectedDate ? branchSchedules[selectedDate] : null;

  const handleHold = async (date, slotIndex) => {
    const schedule = branchSchedules[date];
    if (!schedule) return;
    const slot = schedule.slots[slotIndex];
    const activeHolds = (schedule.holds || []).filter(h => h.expiresAt.toDate() > new Date());
    const totalOccupied = (slot.booked || 0) + activeHolds.filter(h => h.slotIndex === slotIndex).length;
    if (totalOccupied >= slot.capacity) return alert('가득 찼습니다.');

    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/fair_schedules`, `${selectedBranch}_${date}`);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      await updateDoc(docRef, { holds: arrayUnion({ slotIndex, holderId: fairUser.phone, holderName: fairUser.name, expiresAt }) });
    } catch (e) { console.error(e); }
  };

  const handleCancelHold = async (date, slotIndex) => {
    const schedule = branchSchedules[date];
    if (!schedule) return;
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/fair_schedules`, `${selectedBranch}_${date}`);
      const remaining = (schedule.holds || []).filter(h => !(h.slotIndex === slotIndex && h.holderId === fairUser.phone));
      await updateDoc(docRef, { holds: remaining });
    } catch (e) { console.error(e); }
  };

  const handleBook = async (date, slotIndex) => {
    const schedule = branchSchedules[date];
    if (!schedule) return;
    const slot = schedule.slots[slotIndex];
    if (!window.confirm(`${date} ${slot.time} 예약하시겠습니까?`)) return;
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/fair_schedules`, `${selectedBranch}_${date}`);
      const newSlots = [...schedule.slots];
      newSlots[slotIndex] = { ...slot, booked: (slot.booked || 0) + 1 };
      const remainingHolds = (schedule.holds || []).filter(h => !(h.slotIndex === slotIndex && h.holderId === fairUser.phone));
      await updateDoc(docRef, { slots: newSlots, holds: remainingHolds, bookings: arrayUnion({ slotIndex, userId: fairUser.phone, userName: fairUser.name, timestamp: new Date() }) });
      alert('확정되었습니다.');
      setSelectedDate(null);
    } catch (e) { console.error(e); }
  };

  const handleCancelBookingGlobal = async (branchName, date, slotIndex) => {
    const schedule = allGlobalSchedules.find(s => s.date === date && s.branchName === branchName);
    if (!schedule || !window.confirm('취소하시겠습니까?')) return;
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/fair_schedules`, `${branchName}_${date}`);
      const newSlots = [...schedule.slots];
      newSlots[slotIndex] = { ...schedule.slots[slotIndex], booked: Math.max(0, (schedule.slots[slotIndex].booked || 0) - 1) };
      const remainingBookings = (schedule.bookings || []).filter(b => !(b.slotIndex === slotIndex && b.userId === fairUser.phone));
      await updateDoc(docRef, { slots: newSlots, bookings: remainingBookings });
      alert('취소되었습니다.');
    } catch (e) { console.error(e); }
  };

  const renderSlotDots = (dateStr, slot, slotIndex) => {
    const schedule = branchSchedules[dateStr];
    if (!schedule) return null;
    const activeHolds = (schedule.holds || []).filter(h => h.expiresAt.toDate() > now);
    const disabled = slot.disabledIndices || [];
    const dots = [];
    for (let i = 0; i < 3; i++) {
      if (i < (slot.booked || 0)) dots.push('booked');
      else if (disabled.includes(i)) dots.push('disabled');
      else dots.push(activeHolds.some(h => h.slotIndex === slotIndex) ? 'pending' : 'available');
    }
    return (
      <div className="flex gap-[0.5px]">
        {dots.map((type, i) => type !== 'disabled' && (
          <div key={i} className={`w-[3px] h-[3px] rounded-full ${type === 'booked' ? 'bg-slate-300' : type === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
        ))}
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay || 7) - 1; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {['월', '화', '수', '목', '금', '토', '일'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-400 p-2 uppercase">{d}</div>
        ))}
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/20 rounded-lg h-24 sm:h-32" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const schedule = branchSchedules[dateStr];
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          return (
            <button key={day} onClick={() => setSelectedDate(dateStr)} className={`bg-white rounded-xl border ${isToday ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-100'} h-24 sm:h-32 flex flex-col p-2 text-left active:scale-95 transition-all group hover:border-emerald-400`}>
              <span className={`text-xs font-black ${isToday ? 'text-amber-600' : 'text-slate-700'}`}>{day}</span>
              <div className="mt-1 flex-1 overflow-hidden space-y-[1px]">
                {(schedule?.slots || []).map((slot, sIdx) => (
                  <div key={sIdx} className="flex items-center justify-between gap-0.5 leading-none">
                    <span className="text-[6px] font-black text-slate-300 scale-90 origin-left">{slot.time.split(':')[0]}</span>
                    {renderSlotDots(dateStr, slot, sIdx)}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-2 sm:p-8">
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <button onClick={() => {
                  const d = new Date(selectedDate); d.setDate(d.getDate() - 1);
                  const ds = d.toISOString().split('T')[0];
                  if (d.getMonth() !== currentMonth.getMonth()) setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelectedDate(ds);
                }} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
                <div>
                  <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{selectedBranch} 지점</div>
                  <h3 className="text-2xl font-black text-slate-800">{selectedDate.replace(/-/g, '. ')}.</h3>
                </div>
                <button onClick={() => {
                  const d = new Date(selectedDate); d.setDate(d.getDate() + 1);
                  const ds = d.toISOString().split('T')[0];
                  if (d.getMonth() !== currentMonth.getMonth()) setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelectedDate(ds);
                }} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {!activeSchedule ? (
                <div className="py-20 text-center">
                  <AlertTriangle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-black">해당 날짜에 등록된 스케줄이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeSchedule.slots.map((slot, sIdx) => {
                    const activeHolds = (activeSchedule.holds || []).filter(h => h.expiresAt.toDate() > now && h.slotIndex === sIdx);
                    const myHold = activeHolds.find(h => h.holderId === fairUser.phone);
                    const myBooking = (activeSchedule.bookings || []).find(b => b.slotIndex === sIdx && b.userId === fairUser.phone);
                    const isFull = (slot.booked || 0) + activeHolds.length >= slot.capacity;

                    return (
                      <div key={sIdx} className={`p-5 rounded-3xl border-2 transition-all flex flex-col gap-4 ${myBooking ? 'border-emerald-600 bg-emerald-50/30' : myHold ? 'border-amber-400 bg-amber-50 shadow-lg' : isFull ? 'border-slate-50 bg-slate-50 opacity-60' : 'border-slate-100 bg-white hover:border-emerald-400'}`}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="text-lg font-black text-slate-800">{slot.time}</div>
                            <div className="flex gap-1 mt-1">
                              {Array.from({ length: slot.capacity }).map((_, i) => {
                                const isB = i < (slot.booked || 0);
                                const isH = !isB && (i < (slot.booked || 0) + activeHolds.length);
                                return <div key={i} className={`w-3 h-3 rounded-full ${isB ? 'bg-slate-300' : isH ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />;
                              })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {myBooking && <button onClick={() => handleCancelBookingGlobal(selectedBranch, selectedDate, sIdx)} className="px-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black text-xs hover:bg-red-100 transition-all">예약 취소</button>}
                            {myHold && <button onClick={() => handleCancelHold(selectedDate, sIdx)} className="px-4 py-3 bg-white border border-amber-200 text-amber-600 rounded-2xl font-black text-xs hover:bg-amber-100 transition-all">점유 취소</button>}
                            {!isFull && !myHold && !myBooking && <button onClick={() => handleHold(selectedDate, sIdx)} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">점유</button>}
                            {(myHold || (!isFull && !activeHolds.length && !myBooking)) && <button onClick={() => handleBook(selectedDate, sIdx)} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all">예약 확정</button>}
                          </div>
                        </div>
                        {activeHolds.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                            {activeHolds.map((hold, hIdx) => {
                              const remain = Math.max(0, Math.floor((hold.expiresAt.toDate() - now) / 1000));
                              const mm = String(Math.floor(remain / 60)).padStart(2, '0');
                              const ss = String(remain % 60).padStart(2, '0');
                              const isMe = hold.holderId === fairUser.phone;
                              return (
                                <div key={hIdx} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black ${isMe ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                  <User className="w-3 h-3" /><span>{hold.holderName}{isMe ? '(나)' : ''}</span><span className="opacity-60">|</span><span className="font-mono">{mm}:{ss}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 justify-center">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 예약가능</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400" /> 점유중</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300" /> 예약완료</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-4 sm:mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg"><Calendar className="text-white w-6 h-6" /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Robe 예약 현황</h2>
              <div className="flex items-center gap-2">
                <p className="text-slate-400 font-bold text-[10px]">{fairUser?.name} 담당자님</p>
                <button onClick={() => { if (window.confirm('로그아웃 하시겠습니까?')) { localStorage.removeItem('fair_user'); onBack(); } }} className="text-[9px] font-black text-rose-500 hover:text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded transition-all">로그아웃</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMyBookingsOpen(true)} className="relative px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all flex items-center gap-2">
              <BookOpen className="w-4 h-4" />나의 예약
              {myBookings.length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">{myBookings.length}</span>}
            </button>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 shadow-sm outline-none">
              {branches.map(b => <option key={b} value={b}>{b} 지점</option>)}
            </select>
            <button onClick={onBack} className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all"><Undo2 className="w-5 h-5 text-slate-400" /></button>
          </div>
        </header>

        <div className="bg-white p-4 sm:p-8 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-6 sm:mb-10">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] rounded-full border border-emerald-100">{selectedBranch}</span>
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 font-black text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-100 text-xs transition-all">오늘</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>
          </div>
          {loading ? <div className="py-40 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div></div> : renderCalendarGrid()}
        </div>
      </div>

      {isMyBookingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{fairUser.name} 담당자님</div><h3 className="text-2xl font-black text-slate-800">나의 예약 현황</h3></div>
              <button onClick={() => setIsMyBookingsOpen(false)} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-4">
              {myBookings.length === 0 ? <div className="py-20 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><BookOpen className="w-10 h-10 text-slate-200" /></div><p className="text-slate-400 font-black">아직 예약된 내역이 없습니다.</p></div> : 
                myBookings.map((b, idx) => (
                  <div key={idx} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center justify-between group hover:border-emerald-400 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{b.branchName} 지점</span></div>
                      <div className="text-xl font-black text-slate-800">{b.date.replace(/-/g, '. ')}.</div>
                      <div className="text-sm font-bold text-slate-400 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{allGlobalSchedules.find(s => s.date === b.date && s.branchName === b.branchName)?.slots[b.slotIndex]?.time || '시간 정보 없음'}</div>
                    </div>
                    <button onClick={() => handleCancelBookingGlobal(b.branchName, b.date, b.slotIndex)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all active:scale-90"><Trash2 className="w-5 h-5" /></button>
                  </div>
                ))
              }
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0"><button onClick={() => setIsMyBookingsOpen(false)} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all">닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}



function EntrySelectionView({ onSelect }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="p-8 sm:p-10 bg-white rounded-3xl shadow-2xl text-center w-full max-w-md border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-50 rounded-full">
            <LayoutDashboard className="w-12 h-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">ROBE 관리 시스템</h1>
        <p className="text-gray-500 mb-10 text-sm font-medium">진입하실 메뉴를 선택해 주세요.</p>
        
        <div className="space-y-4">
          <button 
            onClick={() => onSelect('login')}
            className="w-full p-6 bg-white border-2 border-gray-100 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50/30 transition-all group shadow-sm"
          >
            <div className="p-3 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">
              <ClipboardList className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-left">
              <div className="text-lg font-black text-gray-800">미계약 입력 폼</div>
              <div className="text-xs text-gray-400 font-bold">기존 계약관리 CRM 접속 (테일러 전용)</div>
            </div>
            <ArrowRight className="ml-auto w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </button>

          <button 
            onClick={() => onSelect('fair')}
            className="w-full p-6 bg-white border-2 border-gray-100 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50/30 transition-all group shadow-sm"
          >
            <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-left">
              <div className="text-lg font-black text-gray-800">박람회 스케줄</div>
              <div className="text-xs text-gray-400 font-bold">박람회 현장 스케줄 및 지점 가용 현황</div>
            </div>
            <ArrowRight className="ml-auto w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FairScheduleEntry({ onSelect, onBack, branches }) {
  const [mode, setMode] = useState('select'); // 'select', 'fair_manager', 'branch_manager'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isInApp, setIsInApp] = useState(false);

  // Auto-Login if session exists
  useEffect(() => {
    const saved = localStorage.getItem('fair_user');
    if (saved) {
      onSelect('fair_manager', JSON.parse(saved));
    }
  }, []);

  // Detect In-App Browser (Kakao, etc.)
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('kakaotalk') || ua.includes('line') || ua.includes('instagram') || ua.includes('fbav')) {
      setIsInApp(true);
    }
  }, []);

  const handleFairManagerLogin = (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('이름과 전화번호를 입력해주세요.');
    
    const userData = { name, phone };
    localStorage.setItem('fair_user', JSON.stringify(userData));
    onSelect('fair_manager', userData);
  };

  // Auto-redirect or Show Guide for Kakao
  const handleEscapeInApp = () => {
    const url = window.location.href;
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      // iOS: Guide to click (...)
      alert('우측 상단의 [...] 버튼을 누른 후 "기본 브라우저로 열기" 또는 "Safari로 열기"를 선택해 주세요.');
    } else {
      // Android: Try to force Chrome
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까? 저장된 로그인 정보가 삭제됩니다.')) {
      localStorage.removeItem('fair_user');
      window.location.reload(); // Quickest way to reset the whole state
    }
  };

  if (isInApp) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full space-y-6 shadow-2xl animate-in zoom-in duration-300">
          <div className="flex justify-center">
            <div className="p-5 bg-amber-50 rounded-[2rem] animate-bounce">
              <Smartphone className="w-12 h-12 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">외부 브라우저 권장</h2>
            <p className="text-sm font-bold text-slate-400 leading-relaxed">
              카카오톡 인앱 브라우저에서는<br/>
              <span className="text-amber-600">로그인 정보가 유실될 위험</span>이 있습니다.
            </p>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-3xl text-[11px] text-left font-bold text-slate-500 space-y-2">
            <p>1. 우측 상단 <span className="text-slate-800">더보기(⋮ 또는 ···)</span> 클릭</p>
            <p>2. <span className="text-slate-800">"다른 브라우저로 열기"</span> 선택</p>
          </div>

          <button 
            onClick={handleEscapeInApp}
            className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            기본 브라우저로 이동 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'fair_manager') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-6">
        <form onSubmit={handleFairManagerLogin} className="p-10 bg-white rounded-[3rem] shadow-2xl text-center w-full max-w-sm border border-slate-100 animate-in zoom-in duration-300">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-amber-50 rounded-[2rem]">
              <UserRound className="w-10 h-10 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">박람회 담당자</h1>
          <p className="text-slate-400 mb-8 text-sm font-bold">상담 예약 및 일정 관리를 시작합니다.</p>
          
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4">성함</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-4">연락처</label>
              <input
                type="tel"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 mt-6 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[10px] leading-relaxed font-bold text-amber-700">
              <span className="text-amber-900 block mb-0.5">⚠️ 중요 안내</span>
              성함과 번호는 <span className="underline decoration-2">ID/PW</span> 역할을 합니다. 정보가 다르면 기존 예약 내역을 취소할 수 없습니다.
            </p>
          </div>

          <button type="submit" className="w-full mt-6 px-4 py-5 bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-slate-100 hover:bg-black transition-all active:scale-95">시작하기</button>
          <button type="button" onClick={() => setMode('select')} className="w-full mt-4 text-slate-400 font-bold text-xs">뒤로가기</button>
        </form>
      </div>
    );
  }

  if (mode === 'branch_manager') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="p-8 sm:p-10 bg-white rounded-3xl shadow-2xl text-center w-full max-w-md border border-gray-100">
          <h1 className="text-2xl font-black text-gray-800 mb-6">지점 선택</h1>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-2">
            {branches.map(branch => (
              <button
                key={branch}
                onClick={() => onSelect('branch_manager', { branch })}
                className="p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all"
              >
                {branch}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMode('select')} className="w-full mt-6 text-gray-400 font-bold text-xs">뒤로가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="p-8 sm:p-10 bg-white rounded-3xl shadow-2xl text-center w-full max-w-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-amber-50 rounded-2xl">
            <Calendar className="w-10 h-10 text-amber-600" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-gray-800 mb-2">박람회 스케줄</h1>
        <p className="text-gray-500 mb-10 text-sm font-medium">담당자 유형을 선택해 주세요.</p>
        
        <div className="space-y-3">
          <button 
            onClick={() => setMode('fair_manager')}
            className="w-full p-5 bg-amber-600 text-white rounded-2xl font-black shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all active:scale-95"
          >
            박람회 담당자
          </button>
          <button 
            onClick={() => setMode('branch_manager')}
            className="w-full p-5 bg-white border-2 border-gray-100 text-gray-800 rounded-2xl font-black hover:border-blue-500 hover:bg-blue-50/30 transition-all active:scale-95"
          >
            지점 담당자
          </button>
          <button 
            onClick={onBack}
            className="w-full py-2 text-gray-400 font-bold text-xs mt-4"
          >
            이전 화면으로
          </button>
        </div>
      </div>
    </div>
  );
}


function LoginComponent({ onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const STAFF_PASSWORD = "0077";
  const ADMIN_PASSWORD = "wjsfir2026";

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setError('');
      onLogin('admin');
    } else if (password === STAFF_PASSWORD) {
      setError('');
      onLogin('staff');
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <form onSubmit={handleLogin} className="p-8 sm:p-10 bg-white rounded-3xl shadow-2xl text-center w-full max-w-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-red-50 rounded-2xl">
            <ClipboardList className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">계약관리 CRM</h1>
        <p className="text-gray-500 mb-8 text-sm font-medium">관리 시스템 접속을 위해 비밀번호를 입력하세요.</p>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500"
            placeholder="비밀번호"
          />
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <button type="submit" className="w-full mt-4 px-4 py-3 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95">접속하기</button>
        <button 
          type="button"
          onClick={onBack}
          className="w-full mt-3 px-4 py-2 text-gray-400 font-bold text-xs hover:text-gray-600 transition-colors"
        >
          이전 화면으로
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [entryMode, setEntryMode] = useState('select'); // 'select', 'login', 'fair'
  const [db, setDb] = useState(null);
  const [branches, setBranches] = useState(['도산', '광교', '구월', '노원', '대전', '부산', '성수', '수원', '압구정', '인천', '잠실']);
  const [fairUser, setFairUser] = useState(() => {
    const saved = localStorage.getItem('fair_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(app);
    setDb(firestoreDb);
  }, []);

  useEffect(() => {
    if (!db) return;
    const settingsCollectionPath = `artifacts/${appId}/public/data/dashboard_settings`;

    const unsubBranches = onSnapshot(doc(db, settingsCollectionPath, 'branches'), (doc) => {
      if (doc.exists() && doc.data().items) setBranches(doc.data().items);
    });

    return () => {
      unsubBranches();
    };
  }, [db]);

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    setAuth(authInstance);

    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePasswordLogin = async (role) => {
    if (auth && !user) {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Anonymous sign-in failed", error);
      }
    }
    setUserRole(role);
    setIsPasswordAuthenticated(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div></div>;
  }

  if (isPasswordAuthenticated && user) {
    return <Dashboard user={user} userRole={userRole} db={db} branches={branches} setBranches={setBranches} />;
  }

  if (entryMode === 'fair') {
    return (
      <FairScheduleEntry 
        branches={branches} 
        onBack={() => setEntryMode('select')} 
        onSelect={(role, data) => {
          if (role === 'fair_manager') {
            setFairUser(data);
            localStorage.setItem('fair_user', JSON.stringify(data));
            setEntryMode('fair_viewer');
          } else {
            setEntryMode(`branch_editor_${data.branch}`);
          }
        }}
      />
    );
  }

  if (entryMode === 'fair_viewer') {
    return (
      <FairScheduleViewer 
        fairUser={fairUser} 
        branches={branches} 
        db={db} 
        onBack={() => setEntryMode('fair')} 
      />
    );
  }

  if (entryMode.startsWith('branch_editor_')) {
    const branch = entryMode.replace('branch_editor_', '');
    return (
      <BranchScheduleEditor 
        branch={branch} 
        db={db} 
        onBack={() => setEntryMode('fair')} 
      />
    );
  }

  if (entryMode === 'login') {
    return <LoginComponent onLogin={handlePasswordLogin} onBack={() => setEntryMode('select')} />;
  }

  return <EntrySelectionView onSelect={setEntryMode} />;
}

const reasonColors = {
  '가격 문제': '#EF4444', '비교 방문': '#F97316', '고객 변심': '#F59E0B',
  '의견 불일치': '#6366F1', '기타': '#6B7280', '노쇼': '#A855F7',
};

const TopNChartReasons = ({ data }) => {
  if (!data) return null;
  const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 5);
  const maxCount = sortedData[0]?.[1] || 0;
  return (
    <div className="flex flex-col space-y-2 p-4">
      {sortedData.map(([label, count]) => (
        <div key={label} className="flex items-center space-x-2">
          <span className="text-sm w-24 truncate">{label}</span>
          <div className="w-full h-4 bg-gray-200 rounded-full">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(count / (maxCount || 1)) * 100}%`, backgroundColor: reasonColors[label] || '#9CA3AF' }}
            ></div>
          </div>
          <span className="text-xs font-bold text-gray-600">{count}</span>
        </div>
      ))}
    </div>
  );
};

const ReportTemplate = ({ data, month }) => {
  if (!data) return null;
  const monthStr = month.toLocaleString('ko-KR', { year: 'numeric', month: 'long' });
  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{
      width: '800px',
      minHeight: '1130px',
      backgroundColor: '#ffffff',
      padding: '40px',
      color: '#1a1a1a',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '3px solid #1a1a1a', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, letterSpacing: '-1px' }}>{monthStr} 성과 보고서</h1>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>CRM 실적 및 대시보드 요약 리포트</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold' }}>출력일시: {todayStr}</p>
          <p style={{ fontSize: '10px', color: '#888' }}>ROBE Dashboard 시스템 생성</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '40px' }}>
        {[
          { label: '전체 DB 예약', value: data.totalDBStats.total, unit: '건', color: '#2563eb' },
          { label: '총 계약성공', value: data.totalDBStats.contracted, unit: '건', color: '#059669' },
          { label: '루어 계약', value: data.lureStats.contracted, unit: '건', color: '#3b82f6' },
          { label: '일반 계약', value: data.totalDBStats.contracted - data.lureStats.contracted, unit: '건', color: '#0ea5e9' },
          { label: '매출 합계', value: data.salespersonStatsMatrix.reduce((acc, row) => acc + (row['매출합계'] || 0), 0).toLocaleString(), unit: '만', color: '#dc2626' }
        ].map((kpi, i) => (
          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 8px', backgroundColor: '#f9fafb', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{kpi.label}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', color: kpi.color }}>{kpi.value}</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af' }}>{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tables Section */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '4px', height: '16px', backgroundColor: '#2563eb' }}></div>
          상담자별 주요 성과 요약
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #374151', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>상담자명</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>전체</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>계약</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>재계약</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>미계약</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>성공률</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>매출(만)</th>
            </tr>
          </thead>
          <tbody>
            {data.salespersonStatsMatrix.slice(0, 15).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{row['상담자명']}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{row['전체']}</td>
                <td style={{ padding: '10px', textAlign: 'center', color: '#059669', fontWeight: 'bold' }}>{row['계약']}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{row['재계약']}</td>
                <td style={{ padding: '10px', textAlign: 'center', color: '#dc2626' }}>{row['미계약']}</td>
                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{row['성공률']}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{Number(row['매출합계']).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.salespersonStatsMatrix.length > 15 && (
          <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '10px', textAlign: 'center' }}>* 상위 15명의 데이터만 표시됨 (전체 {data.salespersonStatsMatrix.length}명)</p>
        )}
      </div>

      {/* Weekly Ranking */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '4px', height: '16px', backgroundColor: '#f59e0b' }}></div>
          주차별 계약 랭킹 (TOP 3)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {Object.keys(data.weeklyTopRankings).sort().map(week => (
            <div key={week} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', backgroundColor: '#fff' }}>
              <p style={{ fontSize: '10px', fontWeight: '900', color: '#374151', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '3px' }}>{week}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {data.weeklyTopRankings[week].map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span style={{ fontWeight: 'bold' }}>{idx + 1}. {r.salesperson}</span>
                    <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{Number(r.finalContractAmount).toLocaleString()}</span>
                  </div>
                ))}
                {data.weeklyTopRankings[week].length === 0 && <p style={{ fontSize: '8px', color: '#9ca3af' }}>데이터 없음</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Signature Area */}
      <div style={{ marginTop: 'auto', paddingTop: '40px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>종합 의견</p>
            <div style={{ width: '100%', height: '100px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fdfdfd' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '30px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '40px' }}>담당자 확인</p>
              <div style={{ width: '80px', borderBottom: '1px solid #1a1a1a' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '40px' }}>관리지점장</p>
              <div style={{ width: '80px', borderBottom: '1px solid #1a1a1a' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '40px' }}>대표이사 직인</p>
              <div style={{ width: '80px', height: '80px', border: '1px dashed #e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#e5e7eb' }}>
                (인)
              </div>
            </div>
          </div>
        </div>
        <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '40px', textAlign: 'center' }}>본 보고서는 ROBE Dashboard 관리 시스템에 의해 자동으로 생성되었습니다.</p>
      </div>
    </div>
  );
};

