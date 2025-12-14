import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, query, deleteDoc, setDoc } from 'firebase/firestore';

// Lucide React for icons
import { ClipboardList, UserRound, ArrowUp, MessageSquare, Plus, ChevronLeft, ChevronRight, Trash2, Copy, Phone, Undo2, History, AlertTriangle, Edit, Lock, Search, ChevronDown, Settings, X, BookOpen, BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const topOfPageRef = useRef(null);
  const formRef = useRef(null);

  const [activeTab, setActiveTab] = useState('uncontracted'); // 'uncontracted' | 'lure'
  const [lureRecords, setLureRecords] = useState([]);
  const [newLureForm, setNewLureForm] = useState({
    branch: '신사', tmPerson: '', consultant: '', customerName: '', status: '계약', reservationDate: '', memo: ''
  });

  const [newRecordForm, setNewRecordForm] = useState({
    customerName: '', customerContact: '', salesperson: '', branch: '신사',
    source: '워크인', reason: '가격 문제', reservationDate: '', reservationTime: '',
    consultationTime: '', recordContent: ''
  });

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState(null);
  const [showRecontractModal, setShowRecontractModal] = useState(false);
  const [recontractRecord, setRecontractRecord] = useState(null);
  const [recontractForm, setRecontractForm] = useState({ salesperson: '', content: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showRevertConfirmModal, setShowRevertConfirmModal] = useState(false);
  const [recordToRevert, setRecordToRevert] = useState(null);

  const [unclosedPage, setUnclosedPage] = useState(1);
  const [recontactedPage, setRecontactedPage] = useState(1);
  const [recontractedCompletedPage, setRecontractedCompletedPage] = useState(1);
  const recordsPerPage = 5;

  const [statsMonth, setStatsMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingList, setEditingList] = useState({ name: '', title: '', items: [] });
  const [newItemText, setNewItemText] = useState('');

  const [sources, setSources] = useState(['워크인', '박람회', '루어', '지인소개', '크라우드', '기타']);
  const [reasons, setReasons] = useState(['가격 문제', '비교 방문', '고객 변심', '의견 불일치', '기타', '노쇼']);
  const [branches, setBranches] = useState(['신사', '광교', '구월', '노원', '대전', '부산', '성수', '수원', '압구정', '인천', '잠실']);

  // -- Separate state for Header Dropdown vs Actual Modal --
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);


  const baseBranchColors = {
    '신사': '#EF4444', '광교': '#F97316', '구월': '#F59E0B', '노원': '#10B981', '대전': '#6B7280',
    '부산': '#3B82F6', '성수': '#A855F7', '수원': '#EC4899', '압구정': '#14B8A6', '인천': '#6366F1',
    '잠실': '#84CC16', '기타': '#78716C'
  };

  // Calculate dynamic colors if branches change
  const branchColors = useMemo(() => {
    const colors = { ...baseBranchColors };
    const palette = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];
    branches.forEach((b, idx) => {
      if (!colors[b]) {
        colors[b] = palette[idx % palette.length];
      }
    });
    return colors;
  }, [branches]);

  const reasonColors = {
    '가격 문제': '#EF4444', '비교 방문': '#F97316', '고객 변심': '#F59E0B',
    '의견 불일치': '#6366F1', '기타': '#6B7280', '노쇼': '#A855F7',
  };

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


  useEffect(() => {
    if (!db || !user) return;
    setLoading(true);
    const collectionPath = `artifacts/${appId}/public/data/unclosed_records`;
    const q = query(collection(db, collectionPath));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedRecords);
      setLoading(false);
    }, (err) => {
      console.error("Data Fetch Error:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, user]);

  useEffect(() => {
    if (!db || !user) return;
    const lureCollectionPath = `artifacts/${appId}/public/data/lure_records`;
    const q = query(collection(db, lureCollectionPath));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLureRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLureRecords(fetchedLureRecords);
    }, (err) => console.error("Lure Data Fetch Error:", err));
    return () => unsubscribe();
  }, [db, user]);

  const handleFormChange = (e) => setNewRecordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleRecontractFormChange = (e) => setRecontractForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!db || !newRecordForm.customerName || !newRecordForm.salesperson || !newRecordForm.recordContent) {
      return setError("필수 항목을 모두 입력해주세요.");
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/unclosed_records`), {
        ...newRecordForm, comments: [], date: new Date(), status: '미계약', recontacted: false
      });
      setNewRecordForm({ customerName: '', customerContact: '', salesperson: '', branch: '신사', source: sources[0] || '', reason: reasons[0] || '', reservationDate: '', reservationTime: '', consultationTime: '', recordContent: '' });
      setError(null);
      topOfPageRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { setError("데이터 추가 중 오류가 발생했습니다."); }
  };

  const handleLureFormChange = (e) => setNewLureForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddLureRecord = async (e) => {
    e.preventDefault();
    if (!db || !newLureForm.tmPerson || !newLureForm.customerName) {
      return setError("필수 항목(담당자, 고객이름)을 입력해주세요.");
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/lure_records`), {
        ...newLureForm, date: new Date()
      });
      setNewLureForm({ branch: '신사', tmPerson: '', consultant: '', customerName: '', status: '계약', reservationDate: '', memo: '' });
      setError(null);
      alert('루어 데이터가 저장되었습니다.');
    } catch (e) { setError("루어 데이터 추가 중 오류가 발생했습니다."); }
  };



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
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleShortcut = (type) => {
    // Close dropdown if open
    setShowSettingsDropdown(false);

    if (type === 'uncontracted') {
      setActiveTab('uncontracted'); // Assuming you want to switch or focus, though forms are separate now
      setTimeout(() => scrollToSection('uncontracted-form-section'), 100);
    } else if (type === 'lure') {
      setActiveTab('lure'); // Switch tab if applicable (though separate forms in current view)
      setTimeout(() => scrollToSection('lure-form-section'), 100);
    }
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
      await updateDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, recordToRevert.id), {
        status: '미계약',
        comments: originalComments,
      });
      setShowRevertConfirmModal(false);
      setRecordToRevert(null);
    } catch (e) {
      setError("미계약으로 되돌리는 중 오류가 발생했습니다.");
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
      return setError("재계약 담당자와 과정 기록을 모두 입력해주세요.");
    }
    try {
      const recontractNote = {
        text: `[재계약 성공] 담당자: ${recontractForm.salesperson}\n과정: ${recontractForm.content}`,
        type: 'recontract-process',
        timestamp: new Date()
      };
      const updatedComments = [...(recontractRecord.comments || []), recontractNote];
      await updateDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, recontractRecord.id), {
        status: 'recontracted', comments: updatedComments,
      });
      setShowRecontractModal(false);
      setRecontractRecord(null);
      setError(null);
    } catch (e) { setError("재계약 처리 중 오류가 발생했습니다."); }
  };

  const handleAddComment = async () => {
    if (!db || !selectedRecord?.id || !newCommentText) return;
    try {
      const newCommentObject = {
        text: newCommentText,
        type: selectedRecord.status === 'recontracted' ? 'follow-up' : 'original',
        timestamp: new Date()
      };
      const updatedComments = [...(selectedRecord.comments || []), newCommentObject];
      await updateDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, selectedRecord.id), { comments: updatedComments });
      setNewCommentText('');
      setSelectedRecord(prev => ({ ...prev, comments: updatedComments }));
    } catch (e) { setError("코멘트 추가 중 오류가 발생했습니다."); }
  };

  const handleDeleteComment = async (commentIndexToDelete, commentType) => {
    if (!db || !selectedRecord?.id) return;
    try {
      const commentsOfType = selectedRecord.comments.filter(c => (typeof c === 'object' ? c.type === commentType : (commentType === 'original' && !c.startsWith('[재계약 성공]'))));
      const otherComments = selectedRecord.comments.filter(c => (typeof c === 'object' ? c.type !== commentType : (commentType === 'original' && c.startsWith('[재계약 성공]'))));

      const updatedCommentsOfType = commentsOfType.filter((_, index) => index !== commentIndexToDelete);

      const finalComments = [...otherComments, ...updatedCommentsOfType];

      await updateDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, selectedRecord.id), { comments: finalComments });
      setSelectedRecord(prev => ({ ...prev, comments: finalComments }));
    } catch (e) {
      setError("코멘트 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteRecord = async () => {
    if (!db || !deleteRecordId) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, deleteRecordId));
      setDeleteRecordId(null);
      setShowConfirmDeleteModal(false);
    } catch (e) { setError("데이터 삭제 중 오류가 발생했습니다."); }
  };

  const toggleRecontact = async (recordId, currentStatus) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/unclosed_records`, recordId), { recontacted: !currentStatus });
    } catch (e) { setError("리컨택 상태 업데이트 중 오류가 발생했습니다."); }
  };

  const openCommentModal = (record) => { setShowHistory(false); setSelectedRecord(record); setShowCommentModal(true); };
  const openConfirmDeleteModal = (recordId) => { setDeleteRecordId(recordId); setShowConfirmDeleteModal(true); };

  const handleCopyRecord = () => {
    if (!selectedRecord) return;
    let copyText = `[기본 정보]\n지점: ${selectedRecord.branch}\n최초 담당자: ${selectedRecord.salesperson}\n고객: ${selectedRecord.customerName} (${selectedRecord.customerContact || '없음'})\n출처: ${selectedRecord.source}\n최초 미계약 사유: ${selectedRecord.reason}`;
    if (selectedRecord.status === 'recontracted') {
      const { process } = parseRecontractInfo(selectedRecord);
      if (process) copyText += `\n\n[재계약 과정 기록]\n${process}`;
    } else {
      copyText += `\n\n[미계약 기록]\n${selectedRecord.recordContent}`;
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
    const recontractor = lines[0]?.replace('[재계약 성공] 담당자: ', '').trim() || 'N/A';
    const process = lines.slice(1).join('\n').replace('과정: ', '').trim();
    return { recontractor, process };
  };

  const getCommentCount = (record) => {
    if (!record || !record.comments) return 0;
    return record.comments.filter(c => (typeof c === 'object' ? c.type !== 'recontract-process' : !c.startsWith('[재계약 성공]'))).length;
  }

  const filteredAndSortedRecords = useMemo(() => {
    let processedRecords = [...records];

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
      const dateA = a.date?.toDate() || 0;
      const dateB = b.date?.toDate() || 0;
      if (sortBy === 'date-asc') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    return processedRecords;
  }, [records, searchTerm, sortBy, reasonFilter, sourceFilter]);

  const allUnclosedRecords = filteredAndSortedRecords.filter(r => r.status !== 'recontracted' && !r.recontacted);
  const recontactedOnlyRecords = filteredAndSortedRecords.filter(r => r.status !== 'recontracted' && r.recontacted);
  const recontractedCompletedRecords = filteredAndSortedRecords.filter(r => r.status === 'recontracted');

  const dashboardData = useMemo(() => {
    const now = new Date();

    const allUnclosedRecords = records.filter(r => r.status !== 'recontracted');
    const activeUnclosed = allUnclosedRecords.filter(r => r.reason !== '노쇼');

    const data = {
      monthlyData: {},
      salespersonBranchMap: {},
      monthTrend: [] // Initialize monthTrend
    };

    activeUnclosed.forEach(r => {
      const d = r.date?.toDate();
      if (!d) return;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      data.monthlyData[mKey] = { total: (data.monthlyData[mKey]?.total || 0) + 1 };
      if (r.salesperson && r.branch) data.salespersonBranchMap[r.salesperson] = r.branch;
    });

    // Populate monthTrend for the last 6 months
    const sortedMonths = Object.keys(data.monthlyData).sort();
    data.monthTrend = sortedMonths.slice(-6).map(m => ({ month: m, total: data.monthlyData[m].total }));


    const statsMonthRecords = allUnclosedRecords.filter(r => {
      const d = r.date?.toDate();
      return d && d.getFullYear() === statsMonth.getFullYear() && d.getMonth() === statsMonth.getMonth();
    });

    const monthlySalespersons = {};
    const monthlyBranches = {};
    const monthlySources = {};
    const monthlyReasons = {};
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

    const currentMonthRecordsCount = activeUnclosed.filter(r => {
      const d = r.date?.toDate();
      return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const lastMonthRecordsCount = activeUnclosed.filter(r => {
      const d = r.date?.toDate();
      return d && d >= lastMonthStart && d <= lastMonthEnd;
    }).length;

    // --- New Stats Logic for Previous Month ---
    const prevStatsMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - 1, 1);
    const prevStatsMonthRecords = allUnclosedRecords.filter(r => {
      const d = r.date?.toDate();
      return d && d.getFullYear() === prevStatsMonth.getFullYear() && d.getMonth() === prevStatsMonth.getMonth();
    });
    const prevMonthlySalespersons = {};
    const prevMonthlyBranches = {};
    prevStatsMonthRecords.forEach(r => {
      if (r.reason !== '노쇼') {
        prevMonthlySalespersons[r.salesperson] = (prevMonthlySalespersons[r.salesperson] || 0) + 1;
        prevMonthlyBranches[r.branch] = (prevMonthlyBranches[r.branch] || 0) + 1;
      }
    });

    // --- New Stats Logic for 2 MONTHS AGO ---
    const twoMonthsAgoStatsMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() - 2, 1);
    const twoMonthsAgoStatsMonthRecords = allUnclosedRecords.filter(r => {
      const d = r.date?.toDate();
      return d && d.getFullYear() === twoMonthsAgoStatsMonth.getFullYear() && d.getMonth() === twoMonthsAgoStatsMonth.getMonth();
    });
    const twoMonthsAgoMonthlySalespersons = {};
    const twoMonthsAgoMonthlyBranches = {};
    twoMonthsAgoStatsMonthRecords.forEach(r => {
      if (r.reason !== '노쇼') {
        twoMonthsAgoMonthlySalespersons[r.salesperson] = (twoMonthsAgoMonthlySalespersons[r.salesperson] || 0) + 1;
        twoMonthsAgoMonthlyBranches[r.branch] = (twoMonthsAgoMonthlyBranches[r.branch] || 0) + 1;
      }
    });

    // --- Lure Stats Logic ---
    const lureStats = { total: lureRecords.length, contracted: 0, uncontracted: 0, contractRate: 0, uncontractRate: 0, noshow: 0, noshowRate: 0 };
    lureRecords.forEach(r => {
      if (r.status === '계약') lureStats.contracted++;
      if (r.status === '미계약') lureStats.uncontracted++;
      if (r.status === '노쇼' || r.status === '미방문') lureStats.noshow++;
    });
    if (lureStats.total > 0) {
      lureStats.contractRate = ((lureStats.contracted / lureStats.total) * 100).toFixed(1);
      lureStats.uncontractRate = ((lureStats.uncontracted / lureStats.total) * 100).toFixed(1);
      lureStats.noshowRate = ((lureStats.noshow / lureStats.total) * 100).toFixed(1);
    }

    const lureMonthlyStats = {};
    lureRecords.forEach(r => {
      const d = r.date?.toDate ? r.date.toDate() : new Date(r.date);
      // Note: r.date might be a timestamp or date object depending on how it's saved.
      // For newly added docs via addDoc with Date(), it's a Timestamp.
      if (!d) return;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!lureMonthlyStats[mKey]) lureMonthlyStats[mKey] = { total: 0, contracted: 0, uncontracted: 0, noshow: 0 };

      lureMonthlyStats[mKey].total++;
      if (r.status === '계약') lureMonthlyStats[mKey].contracted++;
      if (r.status === '미계약') lureMonthlyStats[mKey].uncontracted++;
      if (r.status === '노쇼' || r.status === '미방문') lureMonthlyStats[mKey].noshow++;
    });


    return {
      ...data,
      monthlySalespersons,
      monthlyBranches,
      prevMonthlySalespersons,
      prevMonthlyBranches,
      twoMonthsAgoMonthlySalespersons, // Added
      twoMonthsAgoMonthlyBranches,   // Added
      monthlySources,
      monthlyReasons,
      monthlyNoShowsByBranch,
      totalRecordsCurrentMonth: currentMonthRecordsCount,
      totalRecordsLastMonth: lastMonthRecordsCount,
      lureStats,
      lureMonthlyStats
    };
  }, [records, lureRecords, statsMonth]);


  const handleInputFocus = (e) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddRecord(e);
    }
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
    const chartHeight = 240; // Increased height for better visibility
    const chartWidth = 700; // Adjusted width
    const padding = 40;

    const points = data.map((monthData, index) => {
      const x = (index / (data.length > 1 ? data.length - 1 : 1)) * (chartWidth - padding * 2) + padding;
      const y = chartHeight - padding - ((monthData.total / (maxCount || 1)) * (chartHeight - padding * 2));
      return `${x},${y}`;
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
                <text x={x} y={y - 10} textAnchor="middle" fontSize="12" fill="#4b5563" fontWeight="bold">{monthData.total}</text>
                <text x={x} y={chartHeight - padding + 15} textAnchor="middle" fontSize="12" fill="#9ca3af">{monthData.month.substring(5)}월</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const TopNChart = ({ data, isSalespersonChart = false }) => {
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
    const maxCount = sortedData[0]?.[1] || 0;
    if (sortedData.length === 0) return <div className="p-4 w-full text-center text-gray-500">해당 월 데이터가 없습니다.</div>
    return <div className="flex flex-col space-y-2 p-4 w-full">{sortedData.map(([label, count]) => <div key={label} className="flex items-center space-x-2"><span className="text-sm font-medium text-gray-600 w-24 truncate">{label}</span><div className="w-full h-4 bg-gray-200 rounded-full"><div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: isSalespersonChart ? branchColors[dashboardData.salespersonBranchMap[label]] : branchColors[label] }}></div></div><span className="text-sm">{count}</span></div>)}</div>;
  };

  const PieChart = ({ data }) => {
    const total = Object.values(data).reduce((s, c) => s + c, 0);
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
    const colors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#6B7280', '#06B6D4'];
    let p = 0;
    const paths = sortedData.map(([label, count], i) => {
      const percent = (count / total) * 100;
      const a1 = (p / 100) * 360; p += percent; const a2 = (p / 100) * 360;
      const [x1, y1] = [18 + 15.9155 * Math.cos(Math.PI * (a1 - 90) / 180), 18 + 15.9155 * Math.sin(Math.PI * (a1 - 90) / 180)];
      const [x2, y2] = [18 + 15.9155 * Math.cos(Math.PI * (a2 - 90) / 180), 18 + 15.9155 * Math.sin(Math.PI * (a2 - 90) / 180)];
      return <path key={label} d={`M18,18 L${x1},${y1} A15.9155,15.9155 0 ${percent > 50 ? 1 : 0},1 ${x2},${y2} Z`} fill={colors[i % colors.length]} />;
    });
    return <div className="flex flex-col items-center"><svg viewBox="0 0 36 36" className="w-32 h-32 mb-4">{paths}</svg><div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">{sortedData.map(([l, c], i) => <div key={l} className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors[i % colors.length] }}></span>{l} ({((c / total) * 100).toFixed(0)}%)</div>)}</div></div>;
  };
  const TopNChartReasons = ({ data }) => {
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 5);
    const maxCount = sortedData[0]?.[1] || 0;
    return <div className="flex flex-col space-y-2 p-4">{sortedData.map(([label, count]) => <div key={label} className="flex items-center space-x-2"><span className="text-sm w-24 truncate">{label}</span><div className="w-full h-4 bg-gray-200 rounded-full"><div className="h-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: reasonColors[label] }}></div></div><span>{count}</span></div>)}</div>;
  };

  // --- New Helper Components for Graphs ---

  const renderTrendChart = (data) => {
    const sortedMonths = data.map(d => d.month);
    if (sortedMonths.length < 2) return null;
    const counts = data.map(d => d.total);
    const max = Math.max(...counts, 1);
    const width = 120; // approximate width
    const height = 40;
    const points = counts.map((c, i) => {
      const x = (i / (counts.length - 1)) * width;
      const y = height - ((c / max) * height);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <polyline fill="none" stroke="#EF4444" strokeWidth="2" points={points} />
        {counts.map((c, i) => {
          const x = (i / (counts.length - 1)) * width;
          const y = height - ((c / max) * height);
          return <circle key={i} cx={x} cy={y} r="2" fill="#EF4444" />;
        })}
      </svg>
    );
  };

  const VerticalComparisonBarChart = ({ currentData, prevData, twoMonthsAgoData, colors, mapLabelToColor }) => {
    // Merge keys from all 3 months
    const allKeys = Array.from(new Set([
      ...Object.keys(currentData),
      ...Object.keys(prevData),
      ...(twoMonthsAgoData ? Object.keys(twoMonthsAgoData) : [])
    ]));
    // Sort by current month count descending
    allKeys.sort((a, b) => (currentData[b] || 0) - (currentData[a] || 0));

    // Calculate global max for scaling
    const maxCount = Math.max(
      ...allKeys.map(k => Math.max(
        currentData[k] || 0,
        prevData[k] || 0,
        twoMonthsAgoData ? twoMonthsAgoData[k] || 0 : 0
      )), 1
    );

    return (
      <div className="w-full overflow-x-auto pb-4">
        <div className="flex space-x-8 min-w-max px-4 items-end h-64 pt-8">
          {allKeys.length === 0 && <div className="text-gray-400 text-sm m-auto">데이터 없음</div>}
          {allKeys.map(label => {
            const curr = currentData[label] || 0;
            const prev = prevData[label] || 0;
            const twoAgo = twoMonthsAgoData ? (twoMonthsAgoData[label] || 0) : 0;
            const color = mapLabelToColor ? mapLabelToColor(label) : (colors[label] || '#9CA3AF');

            const currHeight = `${(curr / maxCount) * 100}%`;
            const prevHeight = `${(prev / maxCount) * 100}%`;
            const twoAgoHeight = `${(twoAgo / maxCount) * 100}%`;

            return (
              <div key={label} className="flex flex-col items-center group">
                <div className="flex items-end space-x-1 h-48 border-b border-gray-300 pb-1">
                  {/* Two Months Ago Bar */}
                  {twoMonthsAgoData && (
                    <div className="w-4 bg-gray-200 rounded-t-sm relative group/bar transition-all duration-300 hover:bg-gray-300" style={{ height: twoAgoHeight }}>
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity">{twoAgo}</span>
                    </div>
                  )}
                  {/* Previous Month Bar */}
                  <div className="w-4 bg-gray-400 rounded-t-sm relative group/bar transition-all duration-300 hover:bg-gray-500" style={{ height: prevHeight }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity">{prev}</span>
                  </div>
                  {/* Current Month Bar */}
                  <div className="w-4 rounded-t-sm relative group/bar transition-all duration-300 hover:opacity-80" style={{ height: currHeight, backgroundColor: color }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-black font-bold opacity-100">{curr}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-600 mt-2 rotate-0 truncate w-20 text-center">{label}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center"><div className="w-3 h-3 bg-gray-200 mr-1 rounded-sm"></div>지지난달</div>
          <div className="flex items-center"><div className="w-3 h-3 bg-gray-400 mr-1 rounded-sm"></div>지난달</div>
          <div className="flex items-center"><div className="w-3 h-3 bg-gray-800 mr-1 rounded-sm"></div>이번달</div>
        </div>
      </div>
    );
  };

  const renderLureMonthlyChart = (data) => {
    const sortedMonths = Object.keys(data).sort().slice(-6);
    if (sortedMonths.length === 0) return <div className="h-40 flex items-center justify-center text-gray-500">데이터가 없습니다.</div>;

    const maxTotal = Math.max(...sortedMonths.map(m => data[m].total), 1);

    return (
      <div className="flex justify-around items-end h-48 border-b border-gray-300 pb-2 px-2">
        {sortedMonths.map(m => {
          const stats = data[m];
          const heightPct = (stats.total / maxTotal) * 100;
          return (
            <div key={m} className="flex flex-col items-center w-12 group relative">
              {/* Stacked Bar */}
              <div className="w-full bg-gray-200 rounded-t-sm flex flex-col-reverse overflow-hidden" style={{ height: `${heightPct}%` }}>
                {/* Contracted */}
                <div style={{ height: `${(stats.contracted / stats.total) * 100}%` }} className="bg-blue-500 w-full transition-all" title={`계약: ${stats.contracted}`}></div>
                {/* Uncontracted */}
                <div style={{ height: `${(stats.uncontracted / stats.total) * 100}%` }} className="bg-red-500 w-full transition-all" title={`미계약: ${stats.uncontracted}`}></div>
                {/* NoShow */}
                <div style={{ height: `${(stats.noshow / stats.total) * 100}%` }} className="bg-purple-500 w-full transition-all" title={`노쇼: ${stats.noshow}`}></div>
              </div>
              <div className="text-xs text-gray-500 mt-2">{m.substring(5)}월</div>
              <div className="absolute -top-10 bg-black text-white text-[10px] p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                총: {stats.total} (계약{stats.contracted}/미{stats.uncontracted})
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const PaginatedTable = ({ title, records, currentPage, setCurrentPage, columns, renderRow }) => {
    const totalPages = Math.ceil(records.length / recordsPerPage);
    const paginatedRecords = records.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

    return (
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">{title}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => <th key={col} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr><td colSpan={columns.length} className="p-4 text-center text-gray-500">해당 기록이 없습니다.</td></tr>
              ) : (
                paginatedRecords.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-4 space-x-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-full disabled:opacity-50 hover:bg-gray-100"><ChevronLeft /></button>
            <span>페이지 {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-full disabled:opacity-50 hover:bg-gray-100"><ChevronRight /></button>
          </div>
        )}
      </div>
    );
  };

  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="bg-white p-8 rounded-lg shadow-xl text-center"><h2 className="text-2xl font-bold text-red-600">오류 발생!</h2><p>{error}</p></div></div>;
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col" ref={topOfPageRef}>
      <header className="bg-white p-4 shadow-sm flex flex-col md:flex-row justify-between items-center sticky top-0 z-10 w-full">
        <div className="flex items-center mb-2 md:mb-0">
          <BookOpen className="w-8 h-8 text-red-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-800">미계약 건 관리 Dashboard</h1>
        </div>

        {/* Shortcuts */}
        <div className="flex gap-2 mb-2 md:mb-0">
          <button onClick={() => handleShortcut('uncontracted')} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">
            미계약 기록 바로가기
          </button>
          <button onClick={() => handleShortcut('lure')} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold hover:bg-orange-200 transition-colors">
            새 루어(DB) 기록 바로가기
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
          <p className="text-sm text-gray-600 mr-4 hidden sm:block">
            안녕하세요, <span className="font-semibold">{user.isAnonymous ? '관리자' : user.email}</span>님
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

        {/* Full-width Trend Chart Section */}
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">월별 미계약 건수 추이</h2>
          <div className="w-full relative h-[300px]">
            {dashboardData.monthTrend.length > 0 ? (
              <MonthlyLineChart data={dashboardData.monthTrend} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">데이터 없음</div>
            )}
            <div className="absolute top-4 right-4 text-sm text-gray-500 bg-white bg-opacity-80 p-2 rounded">
              <span className="font-bold text-gray-800 text-lg">{dashboardData.totalRecordsCurrentMonth}</span>
              <span className="ml-1">건 (이번 달)</span>
            </div>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Current Month Unclosed */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-red-500 relative overflow-hidden">
            {/* Sparkline background effect */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              {renderTrendChart(dashboardData.monthTrend)}
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">이번 달 미계약</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardData.totalRecordsCurrentMonth}건</h3>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <BarChart2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex items-center text-sm">
              {/* Trend indicator logic same as before */}
              {(() => {
                const diff = dashboardData.totalRecordsCurrentMonth - dashboardData.totalRecordsLastMonth;
                if (diff > 0) return <span className="text-red-500 font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-1" />+{diff}</span>;
                if (diff < 0) return <span className="text-blue-500 font-bold flex items-center"><TrendingDown className="w-4 h-4 mr-1" />{diff}</span>;
                return <span className="text-gray-500 font-bold flex items-center"><Minus className="w-4 h-4 mr-1" />0</span>;
              })()}
              <span className="text-gray-400 ml-2">지난 달 대비</span>
            </div>
          </div>
          {/* Unclosed Records Trend Card */}
          {/* <div className="bg-white p-5 rounded-2xl shadow-lg col-span-1 sm:col-span-2 flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm mb-1">이번 달 미계약 건수 / 지난 달 대비</p>
                <div className="flex items-center gap-4">
                  <p className="text-3xl font-bold text-red-500">{dashboardData.totalRecordsCurrentMonth}건</p>
                  <div className="flex items-center text-gray-800 text-lg sm:text-2xl">
                    <ArrowUp className={`w-6 h-6 mr-1 ${dashboardData.totalRecordsCurrentMonth >= dashboardData.totalRecordsLastMonth ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
                    <span className="font-bold">{dashboardData.totalRecordsLastMonth > 0 ? `${(((dashboardData.totalRecordsCurrentMonth - dashboardData.totalRecordsLastMonth) / dashboardData.totalRecordsLastMonth) * 100).toFixed(1)}%` : 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="h-16 w-32 sm:w-48">
                {renderTrendChart(dashboardData.monthlyData)}
              </div>
            </div> */}
          {/* Lure Stats Card - Total */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-orange-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">총 루어(DB) 예약</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardData.lureStats.total}건</h3>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Phone className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500">계약률: <span className="font-bold text-orange-600">{dashboardData.lureStats.contractRate}%</span></p>
          </div>

          {/* Lure Stats Card - Contracted */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">루어 계약 성공</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardData.lureStats.contracted}건</h3>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500">미계약: <span className="font-bold text-red-600">{dashboardData.lureStats.uncontracted}건</span></p>
          </div>

          {/* Lure Stats Card - No-Show */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-l-4 border-purple-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">루어 미방문 (노쇼)</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardData.lureStats.noshow}건</h3>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500">노쇼율: <span className="font-bold text-purple-600">{dashboardData.lureStats.noshowRate}%</span></p>
          </div>
        </div>

        {/* Charts Section - Reorganized Separated */}
        <div className="flex flex-col gap-6 mb-6">

          {/* Chart Header & Controls */}
          <div className="bg-white p-4 rounded-2xl shadow-lg flex justify-between items-center sticky top-20 z-10">
            <h2 className="text-lg font-semibold text-gray-700">지점/담당자별 실적 비교 (3개월)</h2>
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

          {/* Salesperson Stats Section */}
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <div className="mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-700">담당자별 실적 비교</h3>
              <p className="text-sm text-gray-400">각 담당자의 최근 3개월 미계약 건수 추이입니다.</p>
            </div>
            <VerticalComparisonBarChart
              currentData={dashboardData.monthlySalespersons}
              prevData={dashboardData.prevMonthlySalespersons}
              twoMonthsAgoData={dashboardData.twoMonthsAgoMonthlySalespersons}
              colors={branchColors} // Using branch colors for diversity, or could map via salespersonBranchMap
              mapLabelToColor={(label) => branchColors[dashboardData.salespersonBranchMap[label]] || '#6B7280'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* <div className="bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">월별 미계약 건수 추이</h2>
              {renderChart(dashboardData.monthlyData, MonthlyLineChart)}
            </div> */}
          <h2 className="text-xl font-semibold text-gray-700">미계약 사유별 비중 (월별)</h2>
          <button onClick={() => openSettingsModal('reasons', '미계약 사유', reasons)} className="p-1 text-gray-400 hover:text-gray-600"><Settings className="w-5 h-5" /></button>
        </div>
        {renderChart(dashboardData.monthlyReasons, TopNChartReasons)}
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-lg sm:col-span-2">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">지점별 노쇼 (월별)</h2>
        {renderChart(dashboardData.monthlyNoShowsByBranch, (props) => <TopNChart {...props} />)}
      </div>

      {/* --- Lure Statistics Section --- */}
      <div className="bg-white p-6 rounded-2xl shadow-lg sm:col-span-2">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">루어(DB) 실적 현황</h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-orange-50 p-4 rounded-xl text-center">
              <h3 className="text-gray-600 text-sm font-semibold">총 상담 예약 (DB)</h3>
              <p className="text-2xl font-bold text-orange-600">{dashboardData.lureStats.total}건</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <h3 className="text-gray-600 text-sm font-semibold">계약 (성공)</h3>
              <p className="text-2xl font-bold text-blue-600">{dashboardData.lureStats.contracted}건</p>
              <p className="text-xs text-blue-400">({dashboardData.lureStats.contractRate}%)</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl text-center">
              <h3 className="text-gray-600 text-sm font-semibold">미계약 (실패)</h3>
              <p className="text-2xl font-bold text-red-600">{dashboardData.lureStats.uncontracted}건</p>
              <p className="text-xs text-red-400">({dashboardData.lureStats.uncontractRate}%)</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl text-center">
              <h3 className="text-gray-600 text-sm font-semibold">미방문 (노쇼)</h3>
              <p className="text-2xl font-bold text-purple-600">{dashboardData.lureStats.noshow}건</p>
              <p className="text-xs text-purple-400">({dashboardData.lureStats.noshowRate}%)</p>
            </div>
          </div>
          {/* Monthly Lure Bar Chart */}
          <div className="h-64 w-full mt-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">월별 루어 예약 및 계약 추이</h3>
            {renderLureMonthlyChart(dashboardData.lureMonthlyStats)}
          </div>
        </div>
      </div>


      <div className="bg-white p-4 rounded-2xl shadow-lg mb-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="고객 또는 담당자 이름..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full sm:w-40 appearance-none p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500">
            <option value="all">모든 출처</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className="w-full sm:w-40 appearance-none p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500">
            <option value="all">모든 사유</option>
            {reasons.map(r => <option key={r} value={r}>{r === '노쇼' ? '노쇼 (카운팅X)' : r}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full sm:w-48 appearance-none p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500">
            <option value="date-desc">기록순 (최신 순)</option>
            <option value="date-asc">기록순 (오래된 순)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        </div>
      </div>

      <PaginatedTable
        title="미계약 건 상세 기록"
        records={allUnclosedRecords}
        currentPage={unclosedPage}
        setCurrentPage={setUnclosedPage}
        columns={['상담일', '리컨택 처리', '지점', '담당자', '고객', '사유', '내용', '액션']}
        renderRow={r => (
          <tr key={r.id}>
            <td className="px-3 py-4 text-sm whitespace-nowrap">{r.date?.toDate().toLocaleDateString('ko-KR')}</td>
            <td className="px-3 py-4"><button onClick={() => toggleRecontact(r.id, r.recontacted)} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 font-semibold">완료 처리</button></td>
            <td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson}</td>
            <td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td>
            <td className="px-3 py-4 text-sm">{r.reason}</td>
            <td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-red-600 hover:text-red-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1" />내용 ({getCommentCount(r)})</button></td>
            <td className="px-3 py-4 text-sm"><div className="flex items-center space-x-4"><button onClick={() => openRecontractModal(r)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">계약</button><button onClick={() => openConfirmDeleteModal(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button></div></td>
          </tr>
        )}
      />
      <PaginatedTable
        title="리컨택 완료 건"
        records={recontactedOnlyRecords}
        currentPage={recontactedPage}
        setCurrentPage={setRecontactedPage}
        columns={['상담일', '완료 취소', '지점', '담당자', '고객', '사유', '내용', '액션']}
        renderRow={r => (
          <tr key={r.id} className="bg-orange-50">
            <td className="px-3 py-4 text-sm whitespace-nowrap">{r.date?.toDate().toLocaleDateString('ko-KR')}</td>
            <td className="px-3 py-4"><button onClick={() => toggleRecontact(r.id, r.recontacted)} className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 font-semibold">처리 취소</button></td>
            <td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson}</td>
            <td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td>
            <td className="px-3 py-4 text-sm">{r.reason}</td>
            <td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-red-600 hover:text-red-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1" />내용 ({getCommentCount(r)})</button></td>
            <td className="px-3 py-4 text-sm"><div className="flex items-center space-x-4"><button onClick={() => openRecontractModal(r)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">계약</button><button onClick={() => openConfirmDeleteModal(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button></div></td>
          </tr>
        )}
      />
      <PaginatedTable title="재계약 완료 기록" records={recontractedCompletedRecords} currentPage={recontractedCompletedPage} setCurrentPage={setRecontractedCompletedPage} columns={['상담일', '지점', '담당자 (재계약자)', '고객', '최초 사유', '내용', '액션']} renderRow={r => { const { recontractor } = parseRecontractInfo(r); return <tr key={r.id} className="bg-green-50 hover:bg-green-100"><td className="px-3 py-4 text-sm whitespace-nowrap">{r.date?.toDate().toLocaleDateString('ko-KR')}</td><td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson} ({recontractor})</td><td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td><td className="px-3 py-4 text-sm">{r.reason}</td><td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-blue-600 hover:text-blue-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1" />내용 ({getCommentCount(r)})</button></td><td className="px-3 py-4 text-sm"><button onClick={() => openRevertConfirmModal(r)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 flex items-center"><Undo2 className="w-3 h-3 mr-1" />미계약으로</button></td></tr> }} />

      <div id="uncontracted-form-section" ref={formRef} className="bg-gray-800 p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-white">새 미계약 건 기록</h2>
        <form onSubmit={handleAddRecord} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-300">지점</label><select name="branch" value={newRecordForm.branch} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500">{branches.map(b => <option key={b}>{b}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-300">담당자</label><input type="text" name="salesperson" value={newRecordForm.salesperson} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" required /></div>
          <div><label className="block text-sm font-medium text-gray-300">고객 이름</label><input type="text" name="customerName" value={newRecordForm.customerName} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" required /></div>
          <div><label className="block text-sm font-medium text-gray-300">고객 연락처</label><input type="tel" name="customerContact" value={newRecordForm.customerContact} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300">고객 출처</label><select name="source" value={newRecordForm.source} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500">{sources.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-300">미계약 사유</label><select name="reason" value={newRecordForm.reason} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500">{reasons.map(r => <option key={r} value={r}>{r === '노쇼' ? '노쇼 (카운팅X)' : r}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-300">예약 날짜</label><input type="date" name="reservationDate" value={newRecordForm.reservationDate} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300">예약 시간</label><input type="time" name="reservationTime" value={newRecordForm.reservationTime} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300">상담 시간</label><input type="text" name="consultationTime" value={newRecordForm.consultationTime} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300">기록 내용</label><textarea name="recordContent" value={newRecordForm.recordContent} onFocus={handleInputFocus} onChange={handleFormChange} onKeyDown={handleKeyDown} rows="3" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-red-500 focus:border-red-500" required></textarea></div>
          <button type="submit" className="w-full flex justify-center items-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"><Plus className="w-5 h-5 mr-2" />기록 추가</button>
        </form>
      </div>

      {/* New Lure Record Form */}
      <div id="lure-form-section" className="bg-gray-800 p-6 rounded-2xl shadow-lg mt-6">
        <h2 className="text-2xl font-bold mb-6 text-white">새 루어(DB) 기록</h2>
        <form onSubmit={handleAddLureRecord} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">지점</label>
            <select name="branch" value={newLureForm.branch} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500">
              {branches.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">TM 예약 담당자</label>
            <input type="text" name="tmPerson" value={newLureForm.tmPerson} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500" required placeholder="예약을 잡은 TM 담당자" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">현장 상담 담당자</label>
            <input type="text" name="consultant" value={newLureForm.consultant} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500" placeholder="실제 상담 및 계약 진행 담당자" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">고객 이름</label>
            <input type="text" name="customerName" value={newLureForm.customerName} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">상태 (결과)</label>
            <select name="status" value={newLureForm.status} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500 pb-2">
              <option value="계약">계약 (Contract)</option>
              <option value="미계약">미계약 (Uncontracted)</option>
              <option value="미방문">미방문/노쇼 (No-Show)</option>
              <option value="방문예정">방문예정 (Scheduled)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">예약 날짜</label>
            <input type="date" name="reservationDate" value={newLureForm.reservationDate} onChange={handleLureFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">메모</label>
            <textarea name="memo" value={newLureForm.memo} onChange={handleLureFormChange} rows="3" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-orange-500 focus:border-orange-500"></textarea>
          </div>
          <button type="submit" className="w-full flex justify-center items-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"><Plus className="w-5 h-5 mr-2" />루어 기록 추가</button>
        </form>
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
                    <div key={item} className={`flex justify-between items-center p-2 rounded-md ${item === '노쇼' ? 'bg-gray-200' : 'bg-gray-100'}`}>
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
            </div>
          </div>
        )
      }

      {showRevertConfirmModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><div className="p-6 bg-white w-full max-w-md rounded-lg shadow-xl text-center"><AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" /><h3 className="text-xl font-bold mb-4">미계약으로 되돌리기</h3><p className="mb-6 text-gray-600">이 작업을 수행하면 재계약 과정 기록과 모든 후속 코멘트가 영구적으로 삭제됩니다. 진행하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowRevertConfirmModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleRevertToUnclosed} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">확인</button></div></div></div>}
      {showRecontractModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><form onSubmit={handleConfirmRecontract} className="p-6 bg-white w-full max-w-lg rounded-lg shadow-xl"><h3 className="text-xl font-bold mb-4">재계약 기록 입력</h3><div className="space-y-4"><div><label className="block text-sm font-medium">재계약 담당자</label><input type="text" name="salesperson" value={recontractForm.salesperson} onChange={handleRecontractFormChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div><div><label className="block text-sm font-medium">재계약 과정 기록</label><textarea name="content" value={recontractForm.content} onChange={handleRecontractFormChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required></textarea></div></div><div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowRecontractModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">저장 및 완료</button></div></form></div>}
      {
        showCommentModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="text-xl font-bold">기록 및 코멘트</h3>
              <button onClick={() => setShowCommentModal(false)} className="text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {selectedRecord.status === 'recontracted' && <div className="mb-4"><button onClick={() => setShowHistory(!showHistory)} className="w-full flex justify-between items-center p-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300"><span>미계약 히스토리 보기</span><History className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} /></button></div>}
              {(showHistory || selectedRecord.status !== 'recontracted') && <div><div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm break-words relative"><p><strong>지점:</strong> {selectedRecord.branch}, <strong>최초 담당자:</strong> {selectedRecord.salesperson}</p><p><strong>고객:</strong> {selectedRecord.customerName} ({selectedRecord.customerContact || '없음'})</p><p><strong>출처:</strong> {selectedRecord.source}, <strong>사유:</strong> {selectedRecord.reason}</p><p><strong>예약:</strong> {selectedRecord.reservationDate || ''} {selectedRecord.reservationTime || ''}</p><p className="mt-2 whitespace-pre-wrap"><strong>최초 기록:</strong> {selectedRecord.recordContent}</p><div className="flex justify-between mt-2 text-gray-500 text-xs"><span>{selectedRecord.date?.toDate().toLocaleString('ko-KR')}</span></div><button onClick={handleCopyRecord} className="absolute bottom-2 right-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"><Copy className="w-4 h-4 mr-1" />복사</button></div><h4 className="font-semibold text-gray-700 mb-2">코멘트 ({(selectedRecord.comments?.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).length || 0)}개)</h4><div className="mb-4 max-h-48 overflow-y-auto space-y-3">{selectedRecord.comments?.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).length > 0 ? selectedRecord.comments.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).map((c, i) => <div key={i} className="flex items-start p-3 rounded-lg text-sm whitespace-pre-wrap bg-gray-100"><p className="flex-grow">{typeof c === 'object' ? c.text : c}</p><button onClick={() => handleDeleteComment(i, 'original')} className="ml-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>) : <p className="text-sm text-gray-500">코멘트가 없습니다.</p>}</div></div>}

              {selectedRecord.status === 'recontracted' && (
                <div>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4 text-sm relative">
                    <h4 className="font-bold text-blue-800 mb-2">재계약 과정 기록</h4>
                    <p className="whitespace-pre-wrap">{parseRecontractInfo(selectedRecord).process}</p>
                    <button onClick={handleCopyRecord} className="absolute bottom-2 right-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"><Copy className="w-4 h-4 mr-1" />복사</button>
                  </div>
                  <h4 className="font-semibold text-gray-700 mb-2">후속 코멘트 ({(selectedRecord.comments?.filter(c => typeof c === 'object' && c.type === 'follow-up').length || 0)}개)</h4>
                  <div className="mb-4 max-h-48 overflow-y-auto space-y-3">{selectedRecord.comments?.filter(c => typeof c === 'object' && c.type === 'follow-up').length > 0 ? selectedRecord.comments.filter(c => typeof c === 'object' && c.type === 'follow-up').map((c, i) => <div key={i} className="flex items-start p-3 rounded-lg text-sm whitespace-pre-wrap bg-gray-100"><p className="flex-grow">{c.text}</p><button onClick={() => handleDeleteComment(i, 'follow-up')} className="ml-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>) : <p className="text-sm text-gray-500">코멘트가 없습니다.</p>}</div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">새 코멘트 추가</label>
              <textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} rows="2" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"></textarea>
              <div className="flex justify-end">
                <button onClick={handleAddComment} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">코멘트 추가</button>
              </div>
            </div>
          </div>
        </div>
      }
      {showConfirmDeleteModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50"><div className="p-8 bg-white w-full max-w-sm rounded-lg shadow-xl text-center"><h3 className="text-xl font-bold mb-4">기록 삭제</h3><p className="mb-6">정말로 삭제하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleDeleteRecord} className="px-4 py-2 bg-red-600 text-white rounded-md">삭제</button></div></div></div>}
    </div >
  );
}

// --- Login Component ---
function LoginComponent({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // ========================= 중요 =========================
  // 여기에 접속에 사용할 비밀번호를 입력하세요.
  // ========================================================
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="p-10 bg-white rounded-2xl shadow-xl text-center w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">미계약 건 관리 대시보드</h1>
        <p className="text-gray-600 mb-6">접속하려면 비밀번호를 입력하세요.</p>
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
        <button
          type="submit"
          className="w-full mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors"
        >
          접속하기
        </button>
      </form>
    </div>
  );
}

// --- App Wrapper ---
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

