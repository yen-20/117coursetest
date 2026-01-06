
import React, { useState } from 'react';
import { UserRole } from '../types';
import { School, User, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { authService } from '../services/authService';

interface AuthViewProps {
  onLoginSuccess: (user: any) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const user = await authService.login(username, password);
        if (user) onLoginSuccess(user);
        else setError('帳號或密碼錯誤');
      } else {
        if (!name || !username || !password) return setError('請填寫所有欄位');
        const newUser = await authService.register(name, username, password, UserRole.STUDENT);
        onLoginSuccess(newUser);
      }
    } catch (err: any) {
      setError(err.message || '發生錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf8] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-50 to-orange-50 p-10 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 text-violet-500 shadow-md">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-stone-800">ClassSync</h1>
          <p className="text-stone-400 text-sm mt-1">雲端班級管理平台</p>
        </div>
        <div className="flex bg-stone-50/50 p-2 gap-2 border-b">
          <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isLogin ? 'bg-white text-violet-600 shadow-sm' : 'text-stone-400'}`}>登入</button>
          <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isLogin ? 'bg-white text-violet-600 shadow-sm' : 'text-stone-400'}`}>學生註冊</button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && <div className="p-4 bg-rose-50 text-rose-500 rounded-xl text-xs font-bold">{error}</div>}
          {!isLogin && <input type="text" placeholder="真實姓名" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-violet-200 outline-none" />}
          <input type="text" placeholder="帳號" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-violet-200 outline-none" />
          <input type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl border-2 border-transparent focus:border-violet-200 outline-none" />
          <button type="submit" className="w-full bg-violet-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-violet-200 flex items-center justify-center gap-2">
            {isLogin ? '登入系統' : '立即註冊'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthView;
