import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Leaderboard from "./components/Leaderboard";
import MatchRecorder from "./components/MatchRecorder";
import Members from "./components/Members";
import Events from "./components/Events";
import BackupRestore from "./components/BackupRestore";
import TournamentDraw from "./components/TournamentDraw";
import { getClubData } from "./utils/db";
import { fetchRemoteData, updateRemoteData, fetchRemoteTimestamp, supabase } from "./utils/supabase";
import { Lock } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState({ members: [], events: [], matches: [] });
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem("pickleball_is_admin") === "true";
  });
  const [recorderSubTab, setRecorderSubTab] = useState("record");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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

  // Tải dữ liệu ban đầu khi ứng dụng khởi chạy và thiết lập các bộ lắng nghe đồng bộ
  useEffect(() => {
    // 1. Tải từ localStorage trước để hiển thị ngay lập tức
    const clubData = getClubData();
    setData(clubData);

    // Lấy nhãn thời gian cục bộ (nếu chưa có thì coi như cực kỳ cũ)
    let localUpdatedAt = localStorage.getItem("pickleball_club_data_updated_at");
    if (!localUpdatedAt) {
      localUpdatedAt = new Date(0).toISOString();
      localStorage.setItem("pickleball_club_data_updated_at", localUpdatedAt);
    }

    // 2. Đồng bộ bất đồng bộ từ đám mây Supabase ngay khi mở ứng dụng
    fetchRemoteData().then(remoteResult => {
      if (remoteResult && remoteResult.data) {
        const remoteUpdatedAt = remoteResult.updated_at || new Date(0).toISOString();
        
        console.log(`Đồng bộ ban đầu - Local updated_at: ${localUpdatedAt}, Remote updated_at: ${remoteUpdatedAt}`);

        if (new Date(remoteUpdatedAt) > new Date(localUpdatedAt)) {
          // Trường hợp 1: Trên đám mây mới hơn -> Tải về thiết bị
          console.log("Dữ liệu đám mây mới hơn dữ liệu cục bộ. Tự động tải về thiết bị!");
          setData(remoteResult.data);
          localStorage.setItem("pickleball_club_data", JSON.stringify(remoteResult.data));
          localStorage.setItem("pickleball_club_data_updated_at", remoteUpdatedAt);
        } else if (new Date(localUpdatedAt) > new Date(remoteUpdatedAt)) {
          // Trường hợp 2: Dưới máy cục bộ mới hơn -> Đẩy lên đám mây
          console.log("Dữ liệu cục bộ mới hơn dữ liệu đám mây. Tự động tải lên Supabase!");
          updateRemoteData(clubData, localUpdatedAt);
        } else {
          console.log("Dữ liệu cục bộ và đám mây đã đồng nhất!");
        }
      } else {
        // Nếu kết nối được Supabase nhưng chưa có dữ liệu (Supabase trống), khởi tạo bằng dữ liệu local hiện tại
        if (clubData && (clubData.members.length > 0 || clubData.matches.length > 0)) {
          console.log("Khởi tạo dữ liệu đám mây Supabase từ LocalStorage...");
          updateRemoteData(clubData, localUpdatedAt);
        }
      }
    });

    // 3. Đăng ký kênh Realtime để nhận thông báo thay đổi tức thời từ Supabase
    let subscription = null;
    if (supabase) {
      console.log("Đang thiết lập Supabase Realtime channel cho bảng pickleball_club...");
      subscription = supabase
        .channel("pickleball_club_changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pickleball_club",
            filter: "id=eq.1"
          },
          (payload) => {
            console.log("Nhận được thay đổi realtime từ Supabase:", payload);
            const remoteUpdatedAt = payload.new.updated_at;
            const currentLocalUpdatedAt = localStorage.getItem("pickleball_club_data_updated_at") || new Date(0).toISOString();

            if (remoteUpdatedAt && new Date(remoteUpdatedAt) > new Date(currentLocalUpdatedAt)) {
              if (payload.new.data) {
                console.log("Cập nhật dữ liệu từ thông báo Realtime...");
                setData(payload.new.data);
                localStorage.setItem("pickleball_club_data", JSON.stringify(payload.new.data));
                localStorage.setItem("pickleball_club_data_updated_at", remoteUpdatedAt);
              } else {
                // Đề phòng data không đi kèm trong payload, gọi fetch full data
                console.log("Realtime: Đang tải toàn bộ dữ liệu do payload thiếu trường data...");
                fetchRemoteData().then(res => {
                  if (res && res.data) {
                    setData(res.data);
                    localStorage.setItem("pickleball_club_data", JSON.stringify(res.data));
                    localStorage.setItem("pickleball_club_data_updated_at", res.updated_at);
                  }
                });
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("Trạng thái kết nối Realtime channel:", status);
        });
    }

    // 4. Cơ chế Polling ngầm nhẹ mỗi 10 giây để kiểm tra chéo (Đề phòng Realtime bị tắt hoặc lỗi)
    const pollInterval = setInterval(() => {
      const currentLocalUpdatedAt = localStorage.getItem("pickleball_club_data_updated_at") || new Date(0).toISOString();
      
      fetchRemoteTimestamp().then(remoteUpdatedAt => {
        if (remoteUpdatedAt && new Date(remoteUpdatedAt) > new Date(currentLocalUpdatedAt)) {
          console.log(`Polling phát hiện dữ liệu đám mây mới hơn (${remoteUpdatedAt} > ${currentLocalUpdatedAt}). Tiến hành tải dữ liệu...`);
          fetchRemoteData().then(res => {
            if (res && res.data) {
              setData(res.data);
              localStorage.setItem("pickleball_club_data", JSON.stringify(res.data));
              localStorage.setItem("pickleball_club_data_updated_at", res.updated_at);
              console.log("Đã cập nhật dữ liệu mới nhất từ Polling thành công!");
            }
          });
        }
      });
    }, 10000);

    // Dọn dẹp subscription và interval khi unmount
    return () => {
      if (subscription && supabase) {
        supabase.removeChannel(subscription);
      }
      clearInterval(pollInterval);
    };
  }, []);

  const renderActiveTab = () => {
    // Các tab được phép truy cập tự do không cần Admin key
    const publicTabs = ["dashboard", "leaderboard"];
    
    // Nếu tab không phải là public và chưa có quyền Admin, hiển thị màn hình khóa
    if (!publicTabs.includes(activeTab) && !isAdmin) {
      return (
        <div className="admin-lock-screen animate-fade-in">
          <style dangerouslySetInnerHTML={{__html: `
            .admin-lock-screen {
              max-width: 480px;
              margin: 80px auto;
              padding: 40px 24px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            .lock-screen-icon {
              width: 76px;
              height: 76px;
              border-radius: 50%;
              background: rgba(255, 71, 87, 0.08);
              border: 1px solid rgba(255, 71, 87, 0.2);
              color: var(--color-danger);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 20px rgba(255, 71, 87, 0.15);
              margin-bottom: 8px;
            }
            .lock-screen-title {
              font-size: 1.4rem;
              font-weight: 800;
              color: #fff;
            }
            .lock-screen-desc {
              font-size: 0.9rem;
              color: var(--text-secondary);
              line-height: 1.6;
              margin-bottom: 8px;
            }
            @media (max-width: 768px) {
              .admin-lock-screen {
                margin: 40px auto;
                padding: 32px 16px;
              }
            }
          `}} />
          <div className="lock-screen-icon">
            <Lock size={32} />
          </div>
          <h2 className="lock-screen-title">Quyền Admin Đã Khóa</h2>
          <p className="lock-screen-desc">
            Tính năng này yêu cầu quyền quản trị (Admin). Vui lòng nhấp nút bên dưới và nhập mã PIN để mở khóa toàn bộ hệ thống.
          </p>
          <button 
            className="btn-neon-green" 
            onClick={() => setIsAuthModalOpen(true)}
            style={{ padding: "12px 28px", fontWeight: "700" }}
          >
            Nhập mã PIN
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return <Dashboard data={data} setData={setData} setActiveTab={setActiveTab} setRecorderSubTab={setRecorderSubTab} />;
      case "leaderboard":
        return <Leaderboard data={data} />;
      case "recorder":
        return <MatchRecorder data={data} setData={setData} setActiveTab={setActiveTab} isAdmin={isAdmin} setIsAdmin={handleSetAdmin} subTab={recorderSubTab} setSubTab={setRecorderSubTab} />;
      case "members":
        return <Members data={data} setData={setData} isAdmin={isAdmin} />;
      case "events":
        return <Events data={data} setData={setData} isAdmin={isAdmin} />;
      case "draw":
        return <TournamentDraw data={data} setData={setData} isAdmin={isAdmin} />;
      case "backup":
        return <BackupRestore data={data} setData={setData} isAdmin={isAdmin} />;
      default:
        return <Dashboard data={data} setData={setData} setActiveTab={setActiveTab} setRecorderSubTab={setRecorderSubTab} />;
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
        isModalOpen={isAuthModalOpen}
        setIsModalOpen={setIsAuthModalOpen}
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
