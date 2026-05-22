import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Leaderboard from "./components/Leaderboard";
import MatchRecorder from "./components/MatchRecorder";
import Members from "./components/Members";
import Events from "./components/Events";
import BackupRestore from "./components/BackupRestore";
import { getClubData } from "./utils/db";
import { fetchRemoteData, updateRemoteData } from "./utils/supabase";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState({ members: [], events: [], matches: [] });
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem("pickleball_is_admin") === "true";
  });

  const handleSetAdmin = (val) => {
    setIsAdmin(val);
    localStorage.setItem("pickleball_is_admin", val ? "true" : "false");
  };

  // Tải dữ liệu ban đầu khi ứng dụng khởi chạy
  useEffect(() => {
    // 1. Tải từ localStorage trước để hiển thị ngay lập tức
    const clubData = getClubData();
    setData(clubData);

    // 2. Đồng bộ bất đồng bộ từ đám mây Supabase
    fetchRemoteData().then(remoteResult => {
      if (remoteResult && remoteResult.data) {
        const remoteMatchesCount = remoteResult.data.matches ? remoteResult.data.matches.length : 0;
        const localMatchesCount = clubData.matches ? clubData.matches.length : 0;

        if (localMatchesCount > remoteMatchesCount) {
          console.log("Dữ liệu cục bộ có nhiều trận đấu hơn, tự động tải lên Supabase để đồng bộ!");
          updateRemoteData(clubData);
        } else {
          console.log("Đồng bộ dữ liệu thành công từ đám mây Supabase!");
          setData(remoteResult.data);
          // Lưu lại localStorage
          localStorage.setItem("pickleball_club_data", JSON.stringify(remoteResult.data));
        }
      } else {
        // Nếu kết nối được Supabase nhưng chưa có dữ liệu (Supabase trống), khởi tạo bằng dữ liệu local hiện tại
        if (clubData && (clubData.members.length > 0 || clubData.matches.length > 0)) {
          console.log("Khởi tạo dữ liệu đám mây Supabase từ LocalStorage...");
          updateRemoteData(clubData);
        }
      }
    });
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard data={data} setData={setData} setActiveTab={setActiveTab} />;
      case "leaderboard":
        return <Leaderboard data={data} />;
      case "recorder":
        return <MatchRecorder data={data} setData={setData} setActiveTab={setActiveTab} isAdmin={isAdmin} setIsAdmin={handleSetAdmin} />;
      case "members":
        return <Members data={data} setData={setData} isAdmin={isAdmin} />;
      case "events":
        return <Events data={data} setData={setData} isAdmin={isAdmin} />;
      case "backup":
        return <BackupRestore data={data} setData={setData} isAdmin={isAdmin} />;
      default:
        return <Dashboard data={data} setData={setData} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-layout">
      <style dangerouslySetInnerHTML={{__html: `
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .app-main-content {
          flex-grow: 1;
        }

        .app-footer {
          border-top: 1px solid var(--border-color);
          background: rgba(8, 9, 13, 0.95);
          padding: 24px;
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .footer-brand {
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .footer-brand span {
          color: var(--accent-neon-green);
        }
      `}} />
      
      {/* Thanh Điều hướng Đầu trang */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isAdmin={isAdmin} 
        setIsAdmin={handleSetAdmin} 
      />
      
      {/* Nội dung trang hiện tại */}
      <main className="app-main-content">
        {renderActiveTab()}
      </main>

      {/* Chân trang (Footer) */}
      <footer className="app-footer">
        <div className="footer-brand">
          PICKLEBALL PHỞ <span>PRO RANK</span>
        </div>
        <div>
          Hệ thống Quản lý và Xếp hạng Thành viên chuyên nghiệp. Thiết kế bởi Antigravity AI.
        </div>
      </footer>
    </div>
  );
}
