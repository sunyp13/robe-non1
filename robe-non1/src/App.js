
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, deleteDoc, doc, updateDoc,
  getDoc, setDoc, arrayUnion, getDocs, deleteField
} from 'firebase/firestore';

// Lucide React for icons

import { ClipboardList, UserRound, ArrowUp, MessageSquare, Plus, ChevronLeft, ChevronRight, Trash2, Copy, Phone, Undo2, History, AlertTriangle, Edit, Lock, Search, ChevronDown, ChevronUp, Calendar, Settings, X, BookOpen, BarChart2, TrendingUp, TrendingDown, Minus, Trophy, RefreshCcw, User, MousePointer2 } from 'lucide-react';

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
function Dashboard({ user }) {
  const [db, setDb] = useState(null);
  // --- Integrated CRM State ---
  const [customerRecords, setCustomerRecords] = useState([]); // Unified records
  const [newCustomerForm, setNewCustomerForm] = useState({
    branch: '대전본점',
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


  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState(null);

  // Phase 3: Consultation Modal State
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [selectedConsultationRecord, setSelectedConsultationRecord] = useState(null);
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
  const [branches, setBranches] = useState(['도산', '광교', '구월', '노원', '대전', '부산', '성수', '수원', '압구정', '인천', '잠실']);

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



  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(app);
    setDb(firestoreDb);
  }, []);

  useEffect(() => {
    if (!db) return;
    const settingsCollectionPath = `artifacts/${appId}/public/data/dashboard_settings`;

    const unsubSources = onSnapshot(doc(db, settingsCollectionPath, 'sources'), (doc) => {
      if (doc.exists() && doc.data().items) setSources(doc.data().items);
    });
    const unsubReasons = onSnapshot(doc(db, settingsCollectionPath, 'reasons'), (doc) => {
      if (doc.exists() && doc.data().items) {
        const fetchedReasons = doc.data().items;
        if (!fetchedReasons.includes('노쇼')) fetchedReasons.push('노쇼');
        setReasons(fetchedReasons);
      }
    });
    const unsubBranches = onSnapshot(doc(db, settingsCollectionPath, 'branches'), (doc) => {
      if (doc.exists() && doc.data().items) setBranches(doc.data().items);
    });

    return () => {
      unsubSources();
      unsubReasons();
      unsubBranches();
    };
  }, [db]);

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
      const val = type === 'checkbox' ? checked : value;
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
    setNewCustomerForm(prev => ({
      ...prev,
      customerName: '', customerContact: '', reservationDate: '', reservationTime: '', memo: '',
      salesperson: '', status: '계약', finalContractAmount: '', consultationContent: '', reason: '',
      mode: 'pending', isImmediateConsult: false
    }));
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

      // Reset Form after success
      setNewCustomerForm(prev => ({
        ...prev,
        customerName: '', customerContact: '', reservationDate: new Date().toISOString().split('T')[0], reservationTime: '14:00', memo: '',
        salesperson: '', status: '대기', finalContractAmount: '', consultationContent: '', reason: '',
        mode: 'pending', isImmediateConsult: false, isRecontracted: false,
        isProcessingExisting: false, existingRecordId: null // Reset linking flags
      }));
      setDuplicateLeads([]);
      setShowDuplicateWarning(false);
      setError(null);
      alert(newCustomerForm.isProcessingExisting ? '상담 기록이 업데이트되었습니다.' : '신규 DB가 성공적으로 등록되었습니다.');
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
      branch: record.branch || '대전본점',
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
      alert('상담 결과가 저장되었습니다.');
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

      // Trend: 6 Months (all sources)
      const trendItem = monthTrend.find(t => t.month === mKey);
      if (trendItem) trendItem.total++;

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
        const sp = r.salesperson || '미지정';
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

      return Object.values(matrix).map(row => ({
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
      // Phase 3 Matrices
      sourceStatsMatrix,
      branchStatsMatrix,
      salespersonStatsMatrix,
      salespersonTrend,
      targetMonths: targetMonths.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
      weeklyTopRankings,
    };
  }, [customerRecords, statsMonth]);






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

        {/* --- 1. Dashboard Tab (Stats & Charts) --- */}
        {activeTab === 'contract_dashboard' && (
          <div className="space-y-6">
            {/* Full-width Trend Chart Section */}
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold text-gray-700 mb-4 font-bold border-b pb-2">📈 월별 미계약 건수 추이</h2>
              <div className="w-full relative h-[300px]">
                {dashboardData.monthTrend.length > 0 ? (
                  <MonthlyLineChart data={dashboardData.monthTrend} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">데이터 없음</div>
                )}
                <div className="absolute top-4 right-4 text-sm text-gray-500 bg-white bg-opacity-80 p-2 rounded shadow-sm">
                  <span className="font-bold text-gray-800 text-lg">{dashboardData.totalRecordsCurrentMonth}</span>
                  <span className="ml-1">건 (이번 달)</span>
                </div>
              </div>
            </div>

            {/* Top KPIs Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {/* Lure (Main) KPI Card */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-3xl shadow-xl text-white border-b-8 border-blue-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[12px] font-black opacity-80 uppercase tracking-widest mb-1">루어 온라인 DB 성과 (선택 월)</p>
                      <div className="flex items-end gap-2">
                        <h3 className="text-5xl font-black tracking-tighter">{dashboardData.lureStats.total}</h3>
                        <span className="text-xl font-bold opacity-60 mb-1">건</span>
                      </div>
                    </div>
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                      <MousePointer2 className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="flex justify-between items-end">
                      <span className="text-[15px] font-bold opacity-90">계약 성공률</span>
                      <span className="text-4xl font-black">{dashboardData.lureStats.total > 0 ? ((dashboardData.lureStats.contracted / dashboardData.lureStats.total) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${dashboardData.lureStats.total > 0 ? (dashboardData.lureStats.contracted / dashboardData.lureStats.total) * 100 : 0}% ` }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-[13px] font-black opacity-90 mt-10 pt-6 border-t border-white/10">
                  <div className="flex flex-col">
                    <span className="opacity-50 text-[10px] uppercase mb-1">계약 완료</span>
                    <span className="text-xl">{dashboardData.lureStats.contracted}건</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="opacity-50 text-[10px] uppercase mb-1">미계약 + 노쇼</span>
                    <span className="text-xl">{dashboardData.lureStats.uncontracted + dashboardData.lureStats.noshow}건</span>
                  </div>
                </div>
              </div>

              {/* General DB Stats Summary Card */}
              <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-[18px] font-black text-gray-800">월간 통합 예약 현황</h4>
                  <Calendar className="w-6 h-6 text-gray-300" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-50">
                    <p className="text-[11px] font-black text-blue-400 uppercase tracking-wider mb-2">전체 DB 예약</p>
                    <p className="text-3xl font-black text-blue-800">{dashboardData.totalDBStats.total}건</p>
                  </div>
                  <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-50">
                    <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-2">계약 성공</p>
                    <p className="text-3xl font-black text-emerald-800">{dashboardData.totalDBStats.contracted}건</p>
                  </div>
                  <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-50">
                    <p className="text-[11px] font-black text-rose-400 uppercase tracking-wider mb-2">미계약 건수</p>
                    <p className="text-3xl font-black text-rose-800">{dashboardData.totalDBStats.uncontracted}건</p>
                  </div>
                  <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">노쇼 합계</p>
                    <p className="text-3xl font-black text-gray-700">{dashboardData.lureStats.noshow}건</p>
                  </div>
                </div>
                <div className="mt-8 p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <BarChart2 className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-[12px] font-bold text-gray-500">전월 대비 예약 증감</span>
                  </div>
                  <span className={`text - sm font - black ${dashboardData.totalRecordsCurrentMonth - dashboardData.totalRecordsLastMonth >= 0 ? 'text-blue-500' : 'text-red-500'} `}>
                    {dashboardData.totalRecordsCurrentMonth - dashboardData.totalRecordsLastMonth >= 0 ? '+' : ''}{dashboardData.totalRecordsCurrentMonth - dashboardData.totalRecordsLastMonth} 건
                  </span>
                </div>
              </div>
            </div>

            {/* Charts Section - Reorganized Separated */}
            <div className="flex flex-col gap-6 mb-6">

              {/* Chart Header & Controls */}
              <div className="bg-white p-4 rounded-2xl shadow-lg flex justify-between items-center sticky top-20 z-10">
                <h2 className="text-lg font-semibold text-gray-700">지점/상담자별 실적 비교 (3개월)</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-gray-200"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-semibold text-gray-600 text-sm">{statsMonth.toLocaleString('ko-KR', { year: 'numeric', month: 'long' })}</span>
                  <button onClick={() => setStatsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-gray-200"><ChevronRight className="w-5 h-5" /></button>
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

              {/* Salesperson Stats Section (New) */}
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                <div className="mb-6 border-b border-gray-50 pb-4">
                  <h3 className="text-xl font-black text-gray-800">상담자별 실적 비교 (3개월 상세)</h3>
                  <p className="text-[12px] font-bold text-gray-400">상담자별 신규계약, 재계약, 미계약 추이를 확인하세요.</p>
                </div>
                <SalespersonTrendSection
                  trendData={dashboardData.salespersonTrend}
                  targetMonths={dashboardData.targetMonths}
                  salespersonSearch={salespersonSearch}
                  setSalespersonSearch={setSalespersonSearch}
                />
              </div>

              {/* Weekly Ranking Section (Integrated) */}
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
                          <div key={r.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className={`w - 7 h - 7 rounded - xl flex items - center justify - center text - [12px] font - black text - white shadow - sm
                              ${idx === 0 ? 'bg-yellow-400 ring-4 ring-yellow-50' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}
    `}>
                                {idx + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-[14px] text-gray-800">{r.salesperson}</span>
                                <span className="text-[10px] font-bold text-gray-400">{r.customerName}</span>
                              </div>
                            </div>
                            <span className="font-black text-blue-600 text-[14px] bg-blue-50 px-2 py-1 rounded-lg">
                              {Number(r.finalContractAmount).toLocaleString()}만
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

              {/* Salesperson Overview Table */}
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* <div className="bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">월별 미계약 건수 추이</h2>
              {renderChart(dashboardData.monthlyData, MonthlyLineChart)}
            </div> */}
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="고객 또는 상담자 이름..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500"
              />
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
                        <input type="text" name="customerName" value={newCustomerForm.customerName} onChange={handleCustomerFormChange} required className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold" placeholder="고객 이름" />
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
                    <textarea name="memo" value={newCustomerForm.memo} onChange={handleCustomerFormChange} rows="2" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="고객 특이사항 입력"></textarea>
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
                            placeholder="입력자 이름"
                            className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {newCustomerForm.mode === 'contracted' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-blue-900 mb-1">최종결제금액 (순위정산용)</label>
                          <input type="number" name="finalContractAmount" value={newCustomerForm.finalContractAmount} onChange={handleCustomerFormChange} className="w-full p-2 border border-blue-200 rounded-lg" placeholder="숫자만 입력 (단위: 만원)" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-blue-900 mb-1">상세 계약금액/메모</label>
                          <input type="text" name="contractAmount" value={newCustomerForm.contractAmount} onChange={handleCustomerFormChange} className="w-full p-2 border border-blue-200 rounded-lg mb-3" placeholder="최종금액 백데이터 정보 메모" />
                          <label className="block text-sm font-semibold text-blue-900 mb-1">계약과정 및 상담내용 작성</label>
                          <textarea name="consultationContent" value={newCustomerForm.consultationContent} onChange={handleCustomerFormChange} rows="3" className="w-full p-2 border border-blue-200 rounded-lg" placeholder="상담시간 60분 같은 내용도 추가"></textarea>
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
                  <button type="submit" className={`w - full py - 4 text - white font - black rounded - 2xl shadow - xl transition - all transform active: scale - 95 flex items - center justify - center text - lg ${newCustomerForm.mode === 'contracted' ? 'bg-blue-600 hover:bg-blue-700' :
                    newCustomerForm.mode === 'uncontracted' ? 'bg-red-500 hover:bg-red-600' :
                      newCustomerForm.mode === 'noshow' ? 'bg-black hover:bg-gray-800' :
                        newCustomerForm.isProcessingExisting ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-600 hover:bg-red-700'
                    } `}>
                    {newCustomerForm.isProcessingExisting ? (
                      <History className="w-6 h-6 mr-2" />
                    ) : (
                      <Plus className="w-6 h-6 mr-2" />
                    )}
                    {newCustomerForm.isProcessingExisting ? (
                      newCustomerForm.mode === 'contracted' ? '계약 완료 저장' :
                        newCustomerForm.mode === 'uncontracted' ? '미계약 저장' :
                          newCustomerForm.mode === 'noshow' ? '노쇼 저장' : '상담 결과 저장'
                    ) : (
                      newCustomerForm.mode === 'contracted' ? '계약 완료 및 등록' :
                        newCustomerForm.mode === 'uncontracted' ? '미계약 및 등록' :
                          newCustomerForm.mode === 'noshow' ? '노쇼 및 등록' : '새로운 고객 등록하기'
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
    </div>
  );
}


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

    let globalMax = 1;
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
                    <div className="flex items-end gap-0.5 h-20 mb-2">
                      <div className="relative flex flex-col items-center">
                        <span className="absolute -top-4 text-[8px] font-bold text-gray-400">{d2}</span>
                        <div style={{ height: `${(d2 / globalMax) * 100}%` }} className="w-2.5 bg-gray-100 rounded-t-[1px]"></div>
                      </div>
                      <div className="relative flex flex-col items-center">
                        <span className="absolute -top-4 text-[8px] font-bold text-gray-500">{d1}</span>
                        <div style={{ height: `${(d1 / globalMax) * 100}%` }} className="w-2.5 bg-gray-300 rounded-t-[1px]"></div>
                      </div>
                      <div className="relative flex flex-col items-center">
                        <span className="absolute -top-5 text-[9px] font-black text-gray-900">{d0}</span>
                        <div style={{ height: `${(d0 / globalMax) * 100}%`, backgroundColor: barColor }} className="w-2.5 rounded-t-[1px] shadow-sm"></div>
                      </div>
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
        <div>
          <h4 className="text-[16px] font-black text-gray-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            상담자별 실적 추이 (3개월 상세)
          </h4>
          <p className="text-[11px] font-bold text-gray-400 mt-1">상담자별 미계약, 재계약, 신규계약 추이를 확인하세요.</p>
        </div>
        <div className="relative w-full md:w-64">
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

const ConsultationModal = ({ record, onClose, onSave, reasons, onAddComment, onDeleteComment, newCommentText, setNewCommentText }) => {
  const [status, setStatus] = useState((record.status === '대기' || !record.status) ? '계약' : record.status);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
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

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCustomerChange = (e) => setCustomerInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = () => {
    onSave(record.id, {
      ...formData,
      ...customerInfo,
      status
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

          <div className="bg-white">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-black text-gray-600">과거 상담 히스토리 보기</span>
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
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
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
                    <label className="block text-sm font-semibold text-blue-900 mb-1">최종결제금액 (순위정산용)</label>
                    <input type="number" name="finalContractAmount" value={formData.finalContractAmount} onChange={handleChange} className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="숫자만 입력 (단위: 만원)" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-900 mb-1">상세 계약금액/메모</label>
                    <input type="text" name="contractAmount" value={formData.contractAmount} onChange={handleChange} className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="최종금액 백데이터 정보 메모" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-900 mb-1">계약과정 및 상담내용 작성</label>
                    <textarea name="consultationContent" value={formData.consultationContent} onChange={handleChange} rows="3" className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="예)상담시간 60분 등"></textarea>
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
        </div>
        <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-3 text-sm bg-white border border-gray-300 rounded-xl font-black text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={handleSubmit} className={`flex-[2] py-3 text-sm text-white rounded-xl font-black shadow-xl transition-all active:scale-95 ${status === '계약' ? 'bg-blue-600 hover:bg-blue-700' :
            status === '미계약' ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-gray-800'
            }`}>상담 결과 저장</button>
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

function LoginComponent({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const CORRECT_PASSWORD = "0077";

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setError('');
      onLogin();
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
        <button type="submit" className="w-full mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">접속하기</button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);

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

  const handlePasswordLogin = async () => {
    if (auth && !user) {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Anonymous sign-in failed", error);
      }
    }
    setIsPasswordAuthenticated(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div></div>;
  }

  return isPasswordAuthenticated && user ? <Dashboard user={user} /> : <LoginComponent onLogin={handlePasswordLogin} />;
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

