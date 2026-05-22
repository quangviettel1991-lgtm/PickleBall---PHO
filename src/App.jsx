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

  // Hàm kiểm tra xem dữ liệu có phải là dữ liệu mẫu mặc định (mock) hay không
  const isMockData = (clubData) => {
    if (!clubData) return true;
    if (!clubData.members || clubData.members.length === 0) return true;
    
    // Nếu chứa bất kỳ ID nào bắt đầu bằng "m_", "e_", hoặc "match_", đây chắc chắn là dữ liệu thực tế của người dùng
    const hasRealMembers = clubData.members.some(m => m.id && m.id.startsWith("m_"));
    const hasRealEvents = clubData.events && clubData.events.some(e => e.id && e.id.startsWith("e_"));
    const hasRealMatches = clubData.matches && clubData.matches.some(m => m.id && m.id.startsWith("match_"));
    
    return !(hasRealMembers || hasRealEvents || hasRealMatches);
  };

  // Tải dữ liệu ban đầu khi ứng dụng khởi chạy
  useEffect(() => {
    // 1. Tải từ localStorage trước để hiển thị ngay lập tức
    const clubData = getClubData();
    setData(clubData);

    // 2. Đồng bộ bất đồng bộ từ đám mây Supabase
    fetchRemoteData().then(remoteResult => {
      if (remoteResult && remoteResult.data) {
        const remoteIsMock = isMockData(remoteResult.data);
        const localIsMock = isMockData(clubData);

        const remoteMatchesCount = remoteResult.data.matches ? remoteResult.data.matches.length : 0;
        const localMatchesCount = clubData.matches ? clubData.matches.length : 0;

        let shouldUpload = false;
        let shouldDownload = false;

        if (remoteIsMock && !localIsMock) {
          // Trường hợp 1: Trên mây đang là dữ liệu mẫu, dưới local đã có dữ liệu thực tế -> Ưu tiên tải lên mây
          console.log("Phát hiện dữ liệu cục bộ là dữ liệu thực tế, dữ liệu trên đám mây là dữ liệu mẫu. Tự động tải lên Supabase!");
          shouldUpload = true;
        } else if (!remoteIsMock && localIsMock) {
          // Trường hợp 2: Trên mây đã có dữ liệu thực tế, dưới local vẫn là dữ liệu mẫu -> Ưu tiên tải về máy
          console.log("Phát hiện dữ liệu đám mây là dữ liệu thực tế, dưới máy là dữ liệu mẫu. Tự động tải về máy!");
          shouldDownload = true;
        } else {
          // Trường hợp 3: Cả hai đều là dữ liệu thật hoặc đều là dữ liệu mẫu -> So sánh số lượng trận đấu
          if (localMatchesCount > remoteMatchesCount) {
            shouldUpload = true;
          } else if (remoteMatchesCount > localMatchesCount) {
            shouldDownload = true;
          } else {
            // Số trận bằng nhau, kiểm tra xem local có trống không để đồng bộ
            if (localMatchesCount === 0 && remoteResult.data.members && remoteResult.data.members.length > 0) {
              shouldDownload = true;
            }
          }
        }

        if (shouldUpload) {
          console.log("Tải dữ liệu lên Supabase...");
          updateRemoteData(clubData);
        } else if (shouldDownload) {
          console.log("Tải dữ liệu từ Supabase về thiết bị...");
          setData(remoteResult.data);
          // Lưu lại localStorage
          localStorage.setItem("pickleball_club_data", JSON.stringify(remoteResult.data));
        } else {
          console.log("Dữ liệu trên máy và trên đám mây đã đồng nhất!");
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
