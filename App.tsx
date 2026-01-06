
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, StudentData, ChatMessage, Assignment, ChatSession, AssignmentMaster, Transaction } from './types';
import { INITIAL_SETTINGS } from './constants';
import ChatRoom from './components/ChatRoom';
import FinanceView from './components/FinanceView';
import QuizView from './components/QuizView';
import AssignmentView from './components/AssignmentView';
import VotingView from './components/VotingView';
import AuthView from './components/AuthView';
import { authService } from './services/authService';
import { LogOut, School, List, CheckSquare, PlusCircle, MinusCircle, X, FolderOpen, Folder, Brain, Wallet, Users, Settings, Heart, Cloud, CloudOff } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [assignmentMasters, setAssignmentMasters] = useState<AssignmentMaster[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAssignmentMasterId, setSelectedAssignmentMasterId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundDesc, setFundDesc] = useState('');
  const [fundType, setFundType] = useState<'income' | 'expense'>('income');

  const [activeTab, setActiveTab] = useState<'list' | 'chat' | 'finance' | 'quiz' | 'assignment' | 'voting'>('finance');

  const refreshAllData = useCallback(async () => {
    const [s, cs, am, cm] = await Promise.all([
        authService.getStudents(),
        authService.getChatSessions(),
        authService.getAssignmentMasters(),
        authService.getChatMessages()
    ]);
    
    setStudents(s);
    setChatSessions(cs);
    setAssignmentMasters(am);
    setChatMessages(cm);
    
    const currentUser = authService.getCurrentUser();
    if (currentUser) setUser(currentUser);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await authService.init();
      await refreshAllData();
      
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setActiveTab(currentUser.role === UserRole.TEACHER ? 'list' : 'finance');
      }
      setLoading(false);
    };
    init();
    
    const interval = setInterval(() => {
        if (authService.getCurrentUser()) refreshAllData();
    }, 5000); 

    return () => clearInterval(interval);
  }, [refreshAllData]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    refreshAllData();
    setActiveTab(loggedInUser.role === UserRole.STUDENT ? 'finance' : 'list');
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setSelectedStudentId(null);
    setActiveTab('finance');
  };

  const toggleStudentCheck = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(checkedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCheckedStudentIds(newSet);
  };

  const toggleSelectAll = () => {
    if (checkedStudentIds.size === students.length) setCheckedStudentIds(new Set());
    else setCheckedStudentIds(new Set(students.map(s => s.id)));
  };

  const handleBulkFundUpdate = async () => {
    if (!fundAmount || !fundDesc) return;
    const amount = parseInt(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    for (const id of Array.from(checkedStudentIds)) {
        const student = students.find(s => s.id === id);
        if (student) {
            const newTransaction: Transaction = {
                id: Date.now().toString() + Math.random().toString(),
                date: new Date().toISOString().split('T')[0],
                description: fundDesc,
                amount: amount,
                type: fundType
            };
            await authService.updateStudent({
                ...student,
                balance: fundType === 'income' ? student.balance + amount : student.balance - amount,
                transactions: [...student.transactions, newTransaction]
            });
        }
    }
    await refreshAllData();
    setIsFundModalOpen(false);
    setCheckedStudentIds(new Set());
  };

  if (loading) return (
    <div className="min-h-screen bg-[#fcfaf8] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin mb-4"></div>
        <p className="text-stone-500 font-bold">同步雲端數據中...</p>
    </div>
  );

  if (!user) return <AuthView onLoginSuccess={handleLoginSuccess} />;

  const targetStudent = user.role === UserRole.STUDENT ? (user as StudentData) : (selectedStudentId ? students.find(s => s.id === selectedStudentId) : null);
  const selectedSession = chatSessions.find(s => s.id === selectedSessionId) || null;
  const selectedAssignmentMaster = assignmentMasters.find(m => m.id === selectedAssignmentMasterId) || null;

  return (
    <div className="min-h-screen bg-[#fcfaf8] flex flex-col md:flex-row font-sans text-stone-600">
      <aside className="bg-white border-r border-stone-100 md:w-72 flex-shrink-0 flex flex-col h-screen sticky top-0">
        <div className="p-8">
           <div className="flex items-center gap-3 text-stone-700 font-extrabold text-2xl">
              <div className="bg-violet-100 p-2 rounded-xl text-violet-600"><School className="w-6 h-6" /></div>
              <span>ClassSync</span>
           </div>
           <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-teal-100">
                    <Cloud className="w-3 h-3" /> Cloud Online
                </div>
           </div>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
          {user.role === UserRole.TEACHER && (
             <NavButton active={activeTab === 'list' && !selectedStudentId} onClick={() => { setActiveTab('list'); setSelectedStudentId(null); }} icon={<Users className="w-5 h-5" />} label="班級名單" />
          )}
          <NavFolder label="匿名聊天室" isActive={activeTab === 'chat'} onClick={() => { setActiveTab('chat'); setSelectedSessionId(null); }} isOpen={activeTab === 'chat'}>
             {chatSessions.map(session => (
                <NavFile key={session.id} label={session.topic} active={selectedSessionId === session.id} onClick={() => setSelectedSessionId(session.id)} />
             ))}
          </NavFolder>
          <NavFolder label="心得作業" isActive={activeTab === 'assignment'} onClick={() => { setActiveTab('assignment'); setSelectedAssignmentMasterId(null); }} isOpen={activeTab === 'assignment'}>
             {assignmentMasters.map(master => (
                 <NavFile key={master.id} label={master.title} active={selectedAssignmentMasterId === master.id} onClick={() => setSelectedAssignmentMasterId(master.id)} />
             ))}
          </NavFolder>
          <NavButton active={activeTab === 'voting'} onClick={() => setActiveTab('voting')} icon={<Heart className="w-5 h-5" />} label="好感度投票" />
          {(user.role === UserRole.STUDENT || selectedStudentId) && (
             <><NavButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<Wallet className="w-5 h-5" />} label="資金帳戶" />
             <NavButton active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} icon={<Brain className="w-5 h-5" />} label="心理測驗" /></>
          )}
        </nav>
        
        <div className="p-6 border-t border-stone-100">
          <button onClick={handleLogout} className="flex items-center gap-3 text-stone-400 hover:text-rose-500 w-full px-4 py-3 rounded-2xl transition-all text-sm font-bold">
            <LogOut className="w-4 h-4" /> 登出系統
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {user.role === UserRole.TEACHER && activeTab === 'list' && !selectedStudentId && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-stone-800">班級管理控制台</h1>
                        <p className="text-stone-500 mt-1 font-medium">目前的學生總數：{students.length} 位</p>
                    </div>
                    <div className="flex gap-3 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
                        <button onClick={toggleSelectAll} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 rounded-xl">全選/取消</button>
                        <button onClick={() => { setFundType('income'); setIsFundModalOpen(true); }} disabled={checkedStudentIds.size === 0} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">發放獎勵</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {students.map(s => (
                        <div key={s.id} onClick={() => { setSelectedStudentId(s.id); setActiveTab('finance'); }} className={`p-6 rounded-3xl border cursor-pointer transition-all ${checkedStudentIds.has(s.id) ? 'bg-violet-50 border-violet-200 shadow-lg' : 'bg-white border-stone-100 hover:shadow-md'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center font-bold">{s.name[0]}</div>
                                <div onClick={(e) => toggleStudentCheck(e, s.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${checkedStudentIds.has(s.id) ? 'bg-violet-500 border-violet-500 text-white' : 'border-stone-200'}`}>✓</div>
                            </div>
                            <h3 className="font-bold text-lg">{s.name}</h3>
                            <div className="mt-4 text-sm text-stone-500 flex justify-between">
                                <span>餘額</span>
                                <span className="font-bold text-stone-800">${s.balance}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'chat' && (
            <ChatRoom currentUser={user} allMessages={chatMessages} selectedSession={selectedSession} onUpdateSession={async (sid, u) => { await authService.updateChatSession(sid, u); refreshAllData(); }} onCreateSession={async (t) => { await authService.createChatSession(t); refreshAllData(); }} onSaveNickname={async (sid, n) => { await authService.saveStudentNickname(user.id, sid, n); refreshAllData(); }} />
        )}

        {activeTab === 'assignment' && (
            <AssignmentView role={user.role} allStudents={students} myAssignments={user.role === UserRole.STUDENT ? (user as StudentData).assignments : []} selectedMaster={selectedAssignmentMaster} onCreateMaster={async (t, d) => { await authService.createAssignmentMaster(t, d); refreshAllData(); }} onStudentSubmit={async (mid, c) => { await authService.onStudentSubmit(mid, c); refreshAllData(); }} onGrade={async (sid, aid, sc) => { await authService.onGrade(sid, aid, sc); refreshAllData(); }} onTeacherReply={async (sid, aid, r) => { await authService.onTeacherReply(sid, aid, r); refreshAllData(); }} />
        )}

        {activeTab === 'voting' && <VotingView currentUser={user} students={students} />}

        {targetStudent && (activeTab === 'finance' || activeTab === 'quiz') && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                {user.role === UserRole.TEACHER && <button onClick={() => setSelectedStudentId(null)} className="text-stone-400 hover:text-stone-800 font-bold">← 返回名單</button>}
                {activeTab === 'finance' && <FinanceView student={targetStudent} currentUserRole={user.role} onManageFund={async (a, d, t) => { if(selectedStudentId) { const s = students.find(x => x.id === selectedStudentId)!; await authService.updateStudent({...s, balance: t === 'income' ? s.balance + a : s.balance - a, transactions: [...s.transactions, {id: Date.now().toString(), amount: a, description: d, type: t, date: new Date().toISOString()}]}); refreshAllData(); } }} />}
                {activeTab === 'quiz' && <QuizView student={targetStudent} viewerRole={user.role} onUpdate={refreshAllData} />}
            </div>
        )}
      </main>

      {isFundModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
                <h3 className="text-2xl font-bold mb-6">{fundType === 'income' ? '發放資金' : '扣除資金'}</h3>
                <div className="space-y-4">
                    <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-violet-300 outline-none" placeholder="輸入金額" />
                    <input type="text" value={fundDesc} onChange={e => setFundDesc(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-violet-300 outline-none" placeholder="輸入原因" />
                    <button onClick={handleBulkFundUpdate} className={`w-full py-4 rounded-2xl text-white font-bold ${fundType === 'income' ? 'bg-teal-500' : 'bg-rose-500'}`}>確認更新 {checkedStudentIds.size} 人</button>
                    <button onClick={() => setIsFundModalOpen(false)} className="w-full py-2 text-stone-400 font-bold">取消</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-4 px-5 py-4 rounded-3xl transition-all w-full cursor-pointer ${active ? 'bg-white text-violet-600 shadow-lg font-bold' : 'text-stone-400 hover:bg-white hover:text-stone-600'}`}>
    {icon} <span className="text-sm">{label}</span>
  </button>
);

const NavFolder: React.FC<{ label: string, isActive: boolean, onClick: () => void, isOpen: boolean, children?: React.ReactNode }> = ({ label, isActive, onClick, isOpen, children }) => (
    <div>
        <button onClick={onClick} className={`flex items-center gap-4 w-full px-5 py-4 rounded-3xl transition-all cursor-pointer ${isActive ? 'text-violet-600 font-bold' : 'text-stone-400'}`}>
            {isOpen ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
            <span className="text-sm">{label}</span>
        </button>
        {isOpen && <div className="ml-8 mt-2 space-y-1 border-l-2 border-stone-100 pl-4">{children}</div>}
    </div>
);

const NavFile: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`block w-full text-left px-4 py-2 rounded-xl text-sm transition-all cursor-pointer ${active ? 'bg-violet-50 text-violet-600 font-bold' : 'text-stone-400 hover:text-stone-600'}`}>
        • {label}
    </button>
);

export default App;
