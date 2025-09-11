import './App.css';
import './index.css';
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, query, deleteDoc } from 'firebase/firestore';

// Lucide React for icons
import { ClipboardList, UserRound, ArrowUp, MessageSquare, Plus, ChevronLeft, ChevronRight, Trash2, Copy, CheckSquare, Phone, Undo2, History, AlertTriangle, Edit, Lock } from 'lucide-react';

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

  const branches = ['신사', '광교', '구월', '노원', '대전', '부산', '성수', '수원', '압구정', '인천', '잠실'];
  const sources = ['워크인', '박람회', '루어', '지인소개', '크라우드', '기타'];
  const reasons = ['가격 문제', '비교 방문', '고객 변심', '의견 불일치', '기타'];
  const branchColors = {
    '신사': '#EF4444', '광교': '#F97316', '구월': '#F59E0B', '노원': '#10B981', '대전': '#6B7280', 
    '부산': '#3B82F6', '성수': '#A855F7', '수원': '#EC4899', '압구정': '#14B8A6', '인천': '#6366F1', 
    '잠실': '#84CC16', '기타': '#78716C',
  };
  const reasonColors = {
    '가격 문제': '#EF4444', '비교 방문': '#F97316', '고객 변심': '#F59E0B', 
    '의견 불일치': '#6366F1', '기타': '#6B7280',
  };

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(app);
    setDb(firestoreDb);
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    setLoading(true);
    const collectionPath = `artifacts/${appId}/users/${user.uid}/unclosed_records`;
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

  const handleFormChange = (e) => setNewRecordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleRecontractFormChange = (e) => setRecontractForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!db || !newRecordForm.customerName || !newRecordForm.salesperson || !newRecordForm.recordContent) {
      return setError("필수 항목을 모두 입력해주세요.");
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`), {
        ...newRecordForm, comments: [], date: new Date(), status: '미계약', recontacted: false
      });
      setNewRecordForm({ customerName: '', customerContact: '', salesperson: '', branch: '신사', source: '워크인', reason: '가격 문제', reservationDate: '', reservationTime: '', consultationTime: '', recordContent: '' });
      setError(null);
      topOfPageRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { setError("데이터 추가 중 오류가 발생했습니다."); }
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
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, recordToRevert.id), {
        status: '미계약',
        comments: originalComments,
      });
      setShowRevertConfirmModal(false);
      setRecordToRevert(null);
    } catch(e) {
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
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, recontractRecord.id), {
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
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, selectedRecord.id), { comments: updatedComments });
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
        
        await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, selectedRecord.id), { comments: finalComments });
        setSelectedRecord(prev => ({ ...prev, comments: finalComments }));
    } catch (e) {
        setError("코멘트 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteRecord = async () => {
    if (!db || !deleteRecordId) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, deleteRecordId));
      setDeleteRecordId(null);
      setShowConfirmDeleteModal(false);
    } catch (e) { setError("데이터 삭제 중 오류가 발생했습니다."); }
  };

  const toggleRecontact = async (recordId, currentStatus) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/unclosed_records`, recordId), { recontacted: !currentStatus });
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

  const allUnclosedRecords = records.filter(r => r.status !== 'recontracted' && !r.recontacted);
  const recontactedOnlyRecords = records.filter(r => r.status !== 'recontracted' && r.recontacted);
  const recontractedCompletedRecords = records.filter(r => r.status === 'recontracted');
  
  const { monthlyData, totalRecordsCurrentMonth, totalRecordsLastMonth, top2Branches, top2Salespersons, monthlySalespersons, monthlyBranches, monthlySources, monthlyReasons, salespersonBranchMap } = (() => {
    const now = new Date();
    const data = { monthlyData: {}, monthlyBranches: {}, monthlySalespersons: {}, monthlySources: {}, monthlyReasons: {}, salespersonBranchMap: {} };
    const activeUnclosed = records.filter(r => r.status !== 'recontracted');
    activeUnclosed.forEach(r => {
      const d = r.date?.toDate();
      if (!d) return;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      data.monthlyData[mKey] = { total: (data.monthlyData[mKey]?.total || 0) + 1 };
      data.monthlySalespersons[r.salesperson] = (data.monthlySalespersons[r.salesperson] || 0) + 1;
      data.monthlyBranches[r.branch] = (data.monthlyBranches[r.branch] || 0) + 1;
      data.monthlySources[r.source] = (data.monthlySources[r.source] || 0) + 1;
      data.monthlyReasons[r.reason] = (data.monthlyReasons[r.reason] || 0) + 1;
      data.salespersonBranchMap[r.salesperson] = r.branch;
    });
    const currentMonthRecordsCount = activeUnclosed.filter(r => r.date?.toDate()?.getFullYear() === now.getFullYear() && r.date?.toDate()?.getMonth() === now.getMonth()).length;
    const lastMonthRecordsCount = activeUnclosed.filter(r => {
      const d = r.date?.toDate();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d && d >= lastMonthStart && d <= lastMonthEnd;
    }).length;
    return {
      ...data,
      totalRecordsCurrentMonth: currentMonthRecordsCount,
      totalRecordsLastMonth: lastMonthRecordsCount,
      top2Branches: Object.entries(data.monthlyBranches).sort(([, a], [, b]) => b - a).slice(0, 2),
      top2Salespersons: Object.entries(data.monthlySalespersons).sort(([, a], [, b]) => b - a).slice(0, 2),
    };
  })();

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
    if (Object.keys(data).length === 0) return <p className="text-center text-gray-500 h-full flex items-center justify-center">데이터가 없습니다.</p>;
    return <ChartComponent data={data} />;
  };

  const MonthlyChart = ({ data }) => {
    const sortedMonths = Object.keys(data).sort().slice(-6);
    const maxCount = Math.max(...sortedMonths.map(m => data[m].total));
    return <div className="flex justify-between items-end h-32 px-2 py-2 border-b-2 border-gray-200">{sortedMonths.map(m => <div key={m} className="relative flex flex-col items-center mx-1 flex-1"><div className="bg-red-400 w-6 rounded-t-lg" style={{ height: `${(data[m].total / (maxCount || 1)) * 100}%` }}></div><span className="text-xs mt-1">{data[m].total}</span><span className="text-xs text-gray-400 mt-1">{m.substring(5)}월</span></div>)}</div>;
  };
  const TopNChart = ({ data, isSalespersonChart = false }) => {
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
    const maxCount = sortedData[0]?.[1] || 0;
    return <div className="flex flex-col space-y-2 p-4 w-full">{sortedData.map(([label, count]) => <div key={label} className="flex items-center space-x-2"><span className="text-sm font-medium text-gray-600 w-24 truncate">{label}</span><div className="w-full h-4 bg-gray-200 rounded-full"><div className="h-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: isSalespersonChart ? branchColors[salespersonBranchMap[label]] : branchColors[label] }}></div></div><span>{count}</span></div>)}</div>;
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
    return <div className="flex flex-col items-center"><svg viewBox="0 0 36 36" className="w-32 h-32 mb-4">{paths}</svg><div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">{sortedData.map(([l, c], i) => <div key={l} className="flex items-center"><span className="w-3 h-3 mr-2" style={{ backgroundColor: colors[i % colors.length] }}></span>{l} ({((c / total) * 100).toFixed(0)}%)</div>)}</div></div>;
  };
  const TopNChartReasons = ({ data }) => {
    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 5);
    const maxCount = sortedData[0]?.[1] || 0;
    return <div className="flex flex-col space-y-2 p-4">{sortedData.map(([label, count]) => <div key={label} className="flex items-center space-x-2"><span className="text-sm w-24 truncate">{label}</span><div className="w-full h-4 bg-gray-200 rounded-full"><div className="h-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: reasonColors[label] }}></div></div><span>{count}</span></div>)}</div>;
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
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-full disabled:opacity-50 hover:bg-gray-100"><ChevronLeft/></button>
                    <span>페이지 {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-full disabled:opacity-50 hover:bg-gray-100"><ChevronRight/></button>
                </div>
            )}
        </div>
    );
  };

  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="bg-white p-8 rounded-lg shadow-xl text-center"><h2 className="text-2xl font-bold text-red-600">오류 발생!</h2><p>{error}</p></div></div>;
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans p-4 sm:p-8 flex flex-col" ref={topOfPageRef}>
      <header className="flex flex-nowrap items-center justify-between bg-white p-2 sm:p-4 rounded-2xl shadow-lg mb-6 sticky top-4 z-10">
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center whitespace-nowrap">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-red-500"/>
            <span>미계약 관리</span>
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center px-3 py-1 bg-red-500 text-white rounded-full text-xs sm:text-sm font-semibold hover:bg-red-600">
            <Edit className="w-4 h-4 mr-1"/>
            기록
          </button>
          <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full min-w-0">
            <UserRound className="w-4 h-4 mr-1 flex-shrink-0"/>
            <span className="truncate">내부 직원</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <div className="w-full space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-lg col-span-1"><p className="text-gray-500 text-sm mb-1">이번 달 미계약 건수 / 지난 달 대비</p><div className="flex items-center gap-4"><p className="text-3xl font-bold text-red-500">{totalRecordsCurrentMonth}건</p><div className="flex items-center text-gray-800 text-lg sm:text-2xl"><ArrowUp className={`w-6 h-6 mr-1 ${totalRecordsCurrentMonth >= totalRecordsLastMonth ? 'text-green-500' : 'text-red-500 rotate-180'}`} /><span className="font-bold">{totalRecordsLastMonth > 0 ? `${(((totalRecordsCurrentMonth - totalRecordsLastMonth) / totalRecordsLastMonth) * 100).toFixed(1)}%` : 'N/A'}</span></div></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-lg col-span-1"><p className="text-gray-500 text-sm mb-1">미계약 순위 (최다)</p><div className="grid grid-cols-2 gap-4 mt-2 text-gray-800"><div><ul className="list-none space-y-1 text-sm">{top2Salespersons.length > 0 ? top2Salespersons.map(([n, c]) => <li key={n}>{n} ({c}건)</li>) : <p className="text-sm text-gray-500">데이터 없음</p>}</ul></div><div className="relative"><div className="absolute left-0 top-0 h-full w-px bg-gray-300"></div><ul className="list-none space-y-1 text-sm pl-4">{top2Branches.length > 0 ? top2Branches.map(([n, c]) => <li key={n}>{n} ({c}건)</li>) : <p className="text-sm text-gray-500">데이터 없음</p>}</ul></div></div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-lg"><h2 className="text-xl font-semibold mb-4 text-gray-700">월별 미계약 건수 추이</h2>{renderChart(monthlyData, MonthlyChart)}</div>
            <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col items-center"><h2 className="text-xl font-semibold mb-4 text-gray-700">지점/담당자별 통계</h2><div className="flex flex-col sm:flex-row w-full"><div className="w-full sm:w-1/2">{renderChart(monthlyBranches, (props) => <TopNChart {...props} />)}</div><div className="w-full sm:w-1/2 relative"><div className="absolute top-0 bottom-0 left-0 w-px bg-gray-300 hidden sm:block"></div>{renderChart(monthlySalespersons, (props) => <TopNChart {...props} isSalespersonChart />)}</div></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-lg"><h2 className="text-xl font-semibold mb-4 text-gray-700">고객 출처별 비중</h2>{renderChart(monthlySources, PieChart)}</div>
            <div className="bg-white p-6 rounded-2xl shadow-lg"><h2 className="text-xl font-semibold mb-4 text-gray-700">미계약 사유별 비중</h2>{renderChart(monthlyReasons, TopNChartReasons)}</div>
          </div>

          <PaginatedTable title="미계약 건 상세 기록" records={allUnclosedRecords} currentPage={unclosedPage} setCurrentPage={setUnclosedPage} columns={['리컨택', '지점', '담당자', '고객', '사유', '내용', '액션']} renderRow={r => (<tr key={r.id}><td className="px-3 py-4"><button onClick={() => toggleRecontact(r.id, r.recontacted)}><CheckSquare className="w-5 h-5 text-gray-300"/></button></td><td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson}</td><td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td><td className="px-3 py-4 text-sm">{r.reason}</td><td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-red-600 hover:text-red-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1"/>내용 ({getCommentCount(r)})</button></td><td className="px-3 py-4 text-sm"><div className="flex items-center space-x-4"><button onClick={() => openRecontractModal(r)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">계약</button><button onClick={() => openConfirmDeleteModal(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button></div></td></tr>)} />
          <PaginatedTable title="리컨택 완료 건" records={recontactedOnlyRecords} currentPage={recontactedPage} setCurrentPage={setRecontactedPage} columns={['리컨택', '지점', '담당자', '고객', '사유', '내용', '액션']} renderRow={r => (<tr key={r.id} className="bg-orange-50"><td className="px-3 py-4"><button onClick={() => toggleRecontact(r.id, r.recontacted)}><CheckSquare className="w-5 h-5 text-green-500"/></button></td><td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson}</td><td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td><td className="px-3 py-4 text-sm">{r.reason}</td><td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-red-600 hover:text-red-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1"/>내용 ({getCommentCount(r)})</button></td><td className="px-3 py-4 text-sm"><div className="flex items-center space-x-4"><button onClick={() => openRecontractModal(r)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">계약</button><button onClick={() => openConfirmDeleteModal(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button></div></td></tr>)} />
          <PaginatedTable title="재계약 완료 기록" records={recontractedCompletedRecords} currentPage={recontractedCompletedPage} setCurrentPage={setRecontractedCompletedPage} columns={['지점', '담당자 (재계약자)', '고객', '최초 사유', '내용', '액션']} renderRow={r => { const { recontractor } = parseRecontractInfo(r); return <tr key={r.id} className="bg-green-50 hover:bg-green-100"><td className="px-3 py-4 text-sm">{r.branch}</td><td className="px-3 py-4 text-sm">{r.salesperson} ({recontractor})</td><td className="px-3 py-4 text-sm"><button onClick={() => r.customerContact && window.open(`tel:${r.customerContact}`)} className={`flex items-center hover:text-blue-600 ${!r.customerContact && 'cursor-default'}`} disabled={!r.customerContact}>{r.customerName}{r.customerContact && <Phone className="w-4 h-4 ml-1" />}</button></td><td className="px-3 py-4 text-sm">{r.reason}</td><td className="px-3 py-4 text-sm"><button onClick={() => openCommentModal(r)} className="inline-flex items-center text-blue-600 hover:text-blue-900 font-semibold"><MessageSquare className="w-4 h-4 mr-1"/>내용 ({getCommentCount(r)})</button></td><td className="px-3 py-4 text-sm"><button onClick={() => openRevertConfirmModal(r)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 flex items-center"><Undo2 className="w-3 h-3 mr-1"/>미계약으로</button></td></tr>}} />
        
          <div ref={formRef} className="bg-gray-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-white">새 미계약 건 기록</h2>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300">지점</label><select name="branch" value={newRecordForm.branch} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md">{branches.map(b => <option key={b}>{b}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-300">담당자</label><input type="text" name="salesperson" value={newRecordForm.salesperson} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" required /></div>
              <div><label className="block text-sm font-medium text-gray-300">고객 이름</label><input type="text" name="customerName" value={newRecordForm.customerName} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" required /></div>
              <div><label className="block text-sm font-medium text-gray-300">고객 연락처</label><input type="tel" name="customerContact" value={newRecordForm.customerContact} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-300">고객 출처</label><select name="source" value={newRecordForm.source} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md">{sources.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-300">미계약 사유</label><select name="reason" value={newRecordForm.reason} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md">{reasons.map(r => <option key={r}>{r}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-300">예약 날짜</label><input type="date" name="reservationDate" value={newRecordForm.reservationDate} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-300">예약 시간</label><input type="time" name="reservationTime" value={newRecordForm.reservationTime} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-300">상담 시간</label><input type="text" name="consultationTime" value={newRecordForm.consultationTime} onFocus={handleInputFocus} onChange={handleFormChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-300">기록 내용</label><textarea name="recordContent" value={newRecordForm.recordContent} onFocus={handleInputFocus} onChange={handleFormChange} onKeyDown={handleKeyDown} rows="3" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md" required></textarea></div>
              <button type="submit" className="w-full flex justify-center items-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"><Plus className="w-5 h-5 mr-2" />기록 추가</button>
            </form>
          </div>
        </div>
      </div>

      {showRevertConfirmModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><div className="p-6 bg-white w-full max-w-md rounded-lg shadow-xl text-center"><AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" /><h3 className="text-xl font-bold mb-4">미계약으로 되돌리기</h3><p className="mb-6 text-gray-600">이 작업을 수행하면 재계약 과정 기록과 모든 후속 코멘트가 영구적으로 삭제됩니다. 진행하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowRevertConfirmModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleRevertToUnclosed} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">확인</button></div></div></div>}
      {showRecontractModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4"><form onSubmit={handleConfirmRecontract} className="p-6 bg-white w-full max-w-lg rounded-lg shadow-xl"><h3 className="text-xl font-bold mb-4">재계약 기록 입력</h3><div className="space-y-4"><div><label className="block text-sm font-medium">재계약 담당자</label><input type="text" name="salesperson" value={recontractForm.salesperson} onChange={handleRecontractFormChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div><div><label className="block text-sm font-medium">재계약 과정 기록</label><textarea name="content" value={recontractForm.content} onChange={handleRecontractFormChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required></textarea></div></div><div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowRecontractModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">저장 및 완료</button></div></form></div>}
      {showCommentModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
        <div className="bg-white w-full max-w-lg rounded-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">기록 및 코멘트</h3>
                <button onClick={() => setShowCommentModal(false)} className="text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto">
                {selectedRecord.status === 'recontracted' && <div className="mb-4"><button onClick={() => setShowHistory(!showHistory)} className="w-full flex justify-between items-center p-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300"><span>미계약 히스토리 보기</span><History className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`}/></button></div>}
                {(showHistory || selectedRecord.status !== 'recontracted') && <div><div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm break-words"><p><strong>지점:</strong> {selectedRecord.branch}, <strong>최초 담당자:</strong> {selectedRecord.salesperson}</p><p><strong>고객:</strong> {selectedRecord.customerName} ({selectedRecord.customerContact || '없음'})</p><p><strong>출처:</strong> {selectedRecord.source}, <strong>사유:</strong> {selectedRecord.reason}</p><p><strong>예약:</strong> {selectedRecord.reservationDate || ''} {selectedRecord.reservationTime || ''}</p><p className="mt-2 whitespace-pre-wrap"><strong>최초 기록:</strong> {selectedRecord.recordContent}</p><div className="flex justify-between mt-2 text-gray-500 text-xs"><span>{selectedRecord.date?.toDate().toLocaleString('ko-KR')}</span></div></div><h4 className="font-semibold text-gray-700 mb-2">코멘트 ({(selectedRecord.comments?.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).length || 0)}개)</h4><div className="mb-4 max-h-48 overflow-y-auto space-y-3">{selectedRecord.comments?.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).length > 0 ? selectedRecord.comments.filter(c => (typeof c === 'object' ? c.type === 'original' : !c.startsWith('[재계약 성공]'))).map((c, i) => <div key={i} className="flex items-start p-3 rounded-lg text-sm whitespace-pre-wrap bg-gray-100"><p className="flex-grow">{typeof c === 'object' ? c.text : c}</p><button onClick={() => handleDeleteComment(i, 'original')} className="ml-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>) : <p className="text-sm text-gray-500">코멘트가 없습니다.</p>}</div></div>}
                
                {selectedRecord.status === 'recontracted' && (
                    <div>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4 text-sm relative">
                            <h4 className="font-bold text-blue-800 mb-2">재계약 과정 기록</h4>
                            <p className="whitespace-pre-wrap">{parseRecontractInfo(selectedRecord).process}</p>
                            <button onClick={handleCopyRecord} className="absolute bottom-2 right-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"><Copy className="w-4 h-4 mr-1"/>복사</button>
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
      </div>}
      {showConfirmDeleteModal && <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50"><div className="p-8 bg-white w-full max-w-sm rounded-lg shadow-xl text-center"><h3 className="text-xl font-bold mb-4">기록 삭제</h3><p className="mb-6">정말로 삭제하시겠습니까?</p><div className="flex justify-center gap-4"><button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">취소</button><button onClick={handleDeleteRecord} className="px-4 py-2 bg-red-600 text-white rounded-md">삭제</button></div></div></div>}
    </div>
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
