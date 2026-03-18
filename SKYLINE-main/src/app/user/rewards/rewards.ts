import { Component, OnInit } from '@angular/core';
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
export class Rewards implements OnInit {
  userData: UserData | null = null;
  displayedRanks: Rank[] = [];

  private allRanks: Record<string, Rank> = {};
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

      if (this.userData?.email) {
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

      this.fetchRankBenefits();
    } else {
      console.warn('Chưa có user đăng nhập');
    }
  }

  get currentRankLabel(): string {
    const key = this.getCanonicalRankKey(this.userData?.currentRank);
    if (key) {
      return this.getVietnameseRankName(key);
    }
    return this.userData?.currentRank ?? '';
  }

  get nextRankLabel(): string {
    if (!this.userData) return '';

    const nextFromData = this.getCanonicalRankKey(this.userData.nextRank);
    if (nextFromData && this.allRanks[nextFromData]) {
      return this.getVietnameseRankName(nextFromData);
    }

    const current = this.getCanonicalRankKey(this.userData.currentRank);
    if (!current) return this.userData.nextRank ?? '';

    const next = this.getNextRank(current);
    return next ? this.getVietnameseRankName(next) : 'Hạng cao nhất';
  }

  get progressPercent(): number {
    if (!this.userData?.nextThreshold || this.userData.nextThreshold <= 0) return 0;
    const raw = (this.userData.points / this.userData.nextThreshold) * 100;
    return Math.max(0, Math.min(100, raw));
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
        this.allRanks = config?.ranks ?? {};
        this.updateDisplayedRanks();
      },
      error: () => {
        this.allRanks = {};
        this.updateDisplayedRanks();
      },
    });
  }

  private updateDisplayedRanks(): void {
    if (!this.userData || Object.keys(this.allRanks).length === 0) {
      this.displayedRanks = [];
      return;
    }

    const current = this.getCanonicalRankKey(this.userData.currentRank);
    if (!current || !this.allRanks[current]) {
      this.displayedRanks = [];
      return;
    }

    const nextFromUser = this.getCanonicalRankKey(this.userData.nextRank);
    const next = nextFromUser ?? this.getNextRank(current);

    this.displayedRanks = [this.allRanks[current]];
    if (next && this.allRanks[next]) {
      this.displayedRanks.push(this.allRanks[next]);
    }
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
}
