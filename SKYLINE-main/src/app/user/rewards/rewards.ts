import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserApiService, RankBenefitsConfig } from '../../services/user-api.service';

interface Rank {
  name: string;
  benefits: string[];
}

interface UserData {
  fullName: string;
  email?: string;
  currentRank: string;
  points: number;
  nextRank: string;
  nextThreshold: number;
  avatar?: string;
}

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rewards.html',
  styleUrls: ['./rewards.css'],
})
export class Rewards implements OnInit, OnDestroy {
  userData: UserData | null = null;
  displayedRanks: Rank[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  private allRanks: Record<string, Rank> = {};
  private readonly fallbackRanks: Record<string, Rank> = {
    Bronze: {
      name: 'Hạng Đồng',
      benefits: ['Tích điểm cơ bản theo giao dịch.', 'Nhận thông báo ưu đãi định kỳ.']
    },
    Silver: {
      name: 'Hạng Bạc',
      benefits: ['Ưu tiên hỗ trợ khách hàng.', 'Tích điểm nhanh hơn hạng Đồng.']
    },
    Gold: {
      name: 'Hạng Vàng',
      benefits: ['Ưu tiên chọn chỗ và dịch vụ hỗ trợ.', 'Ưu đãi độc quyền theo chương trình.']
    },
    Platinum: {
      name: 'Hạng Bạch Kim',
      benefits: ['Đặc quyền cao nhất cho hội viên thân thiết.', 'Ưu tiên xử lý dịch vụ toàn diện.']
    },
  };
  private readonly rankOrder = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  private readonly rankAliases: Record<string, string> = {
    dong: 'Bronze',
    bronze: 'Bronze',
    bac: 'Silver',
    silver: 'Silver',
    vang: 'Gold',
    gold: 'Gold',
    bachkim: 'Platinum',
    platinum: 'Platinum',
  };

  constructor(private userApiService: UserApiService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('fullUserData');

    if (saved) {
      this.userData = JSON.parse(saved);

      this.refreshUserData();
      this.refreshTimer = setInterval(() => this.refreshUserData(), 10000);

      this.fetchRankBenefits();
    } else {
      console.warn('Chưa có user đăng nhập');
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  get currentRankLabel(): string {
    return this.getVietnameseRankName(this.getEffectiveRankProgress().currentRank);
  }

  get nextRankLabel(): string {
    return this.getVietnameseRankName(this.getEffectiveRankProgress().nextRank);
  }

  get progressPercent(): number {
    const progress = this.getEffectiveRankProgress();
    if (!this.userData || !progress.nextThreshold || progress.nextThreshold <= 0) return 0;
    const raw = (this.userData.points / progress.nextThreshold) * 100;
    return Math.max(0, Math.min(100, raw));
  }

  get progressTargetThreshold(): number {
    return this.getEffectiveRankProgress().nextThreshold;
  }

  getRankClass(rankName: string): string {
    const key = this.getCanonicalRankKey(rankName);
    if (!key) return '';
    return `rank-${key.toLowerCase()}`;
  }

  getRankTitle(rankName: string): string {
    const key = this.getCanonicalRankKey(rankName);
    const label = key ? this.getVietnameseRankName(key) : rankName || '';

    if (key === 'Bronze') {
      return `${label} - Quyền lợi dành cho khách hàng thân thiết mức cơ bản.`;
    }

    if (key === 'Silver') {
      return `${label} - Quyền lợi nâng cao với ưu đãi tốt hơn cho thành viên thường xuyên.`;
    }

    if (key === 'Gold') {
      return `${label} - Quyền lợi cao cấp với ưu tiên dịch vụ và tích điểm vượt trội.`;
    }

    if (key === 'Platinum') {
      return `${label} - Quyền lợi đặc quyền cao nhất với ưu tiên toàn diện.`;
    }

    return `${label} - Quyền lợi theo hạng thành viên.`;
  }

  private getVietnameseRankName(rank: string): string {
    if (rank === 'Bronze') return 'Hạng Đồng';
    if (rank === 'Silver') return 'Hạng Bạc';
    if (rank === 'Gold') return 'Hạng Vàng';
    if (rank === 'Platinum') return 'Hạng Bạch Kim';
    return rank;
  }

  private fetchRankBenefits(): void {
    this.userApiService.getRankBenefits().subscribe({
      next: (config: RankBenefitsConfig) => {
        const mapped = this.normalizeRankConfig(config?.ranks ?? {});
        this.allRanks = Object.keys(mapped).length > 0 ? mapped : this.fallbackRanks;
        this.updateDisplayedRanks();
      },
      error: () => {
        this.allRanks = this.fallbackRanks;
        this.updateDisplayedRanks();
      },
    });
  }

  private refreshUserData(): void {
    if (!this.userData?.email) {
      this.updateDisplayedRanks();
      return;
    }

    this.userApiService.getByEmail(this.userData.email).subscribe({
      next: (user) => {
        this.userData = {
          fullName: user.fullName,
          email: user.email,
          currentRank: user.currentRank,
          points: user.points,
          nextRank: user.nextRank,
          nextThreshold: user.nextThreshold,
          avatar: user.avatar,
        };
        localStorage.setItem('fullUserData', JSON.stringify(user));
        this.updateDisplayedRanks();
      },
      error: () => {
        this.updateDisplayedRanks();
      },
    });
  }

  private normalizeRankConfig(rawRanks: Record<string, Rank>): Record<string, Rank> {
    const normalized: Record<string, Rank> = {};

    Object.entries(rawRanks || {}).forEach(([key, value]) => {
      const canonical = this.getCanonicalRankKey(key) || this.getCanonicalRankKey(value?.name);
      if (!canonical) {
        return;
      }

      normalized[canonical] = {
        name: value?.name || this.getVietnameseRankName(canonical),
        benefits: Array.isArray(value?.benefits) ? value.benefits : [],
      };
    });

    return normalized;
  }

  private updateDisplayedRanks(): void {
    if (!this.userData) {
      this.displayedRanks = [];
      return;
    }

    const progress = this.getEffectiveRankProgress();
    const current = progress.currentRank;
    const currentRankData = this.resolveRankData(current);

    const next = progress.nextRank;
    const nextRankData = next ? this.resolveRankData(next) : null;

    this.displayedRanks = [currentRankData];
    if (next && nextRankData) {
      this.displayedRanks.push(nextRankData);
    }
  }

  private resolveRankData(rankKey: string): Rank {
    return this.allRanks[rankKey]
      || this.fallbackRanks[rankKey]
      || {
        name: this.getVietnameseRankName(rankKey),
        benefits: ['Quyền lợi đang được cập nhật.']
      };
  }

  private getCanonicalRankKey(rank: string | undefined): string | null {
    if (!rank) return null;

    const normalized = rank
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (this.rankAliases[normalized]) {
      return this.rankAliases[normalized];
    }

    if (normalized.includes('bronze') || normalized.includes('dong')) return 'Bronze';
    if (normalized.includes('silver') || normalized.includes('bac')) return 'Silver';
    if (normalized.includes('gold') || normalized.includes('vang')) return 'Gold';
    if (normalized.includes('platinum') || normalized.includes('bachkim')) return 'Platinum';

    return null;
  }

  private getNextRank(current: string): string | null {
    const index = this.rankOrder.indexOf(current);
    if (index < 0 || index >= this.rankOrder.length - 1) return null;
    return this.rankOrder[index + 1];
  }

  private getEffectiveRankProgress(): { currentRank: string; nextRank: string; nextThreshold: number } {
    const safePoints = Math.max(0, Number(this.userData?.points || 0));

    if (safePoints >= 5000) {
      return { currentRank: 'Platinum', nextRank: 'Platinum', nextThreshold: 5000 };
    }

    if (safePoints >= 2000) {
      return { currentRank: 'Gold', nextRank: 'Platinum', nextThreshold: 5000 };
    }

    if (safePoints >= 500) {
      return { currentRank: 'Silver', nextRank: 'Gold', nextThreshold: 2000 };
    }

    return { currentRank: 'Bronze', nextRank: 'Silver', nextThreshold: 500 };
  }
}
