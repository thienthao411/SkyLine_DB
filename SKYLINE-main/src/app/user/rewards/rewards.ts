import { Component, OnInit } from '@angular/core';
import rewardsData from './rewards-data.json'; // file chỉ chứa quyền lợi
import { CommonModule } from '@angular/common';

interface Rank {
  name: string;
  benefits: string[];
}

interface UserData {
  fullName: string;
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

  private allRanks: { [key: string]: Rank } = rewardsData.ranks;

  ngOnInit(): void {
    const saved = localStorage.getItem('fullUserData');
    if (saved) {
      this.userData = JSON.parse(saved);
      this.updateDisplayedRanks();
    } else {
      console.warn('Chưa có user đăng nhập');
    }
  }

  private updateDisplayedRanks(): void {
    if (!this.userData) return;

    const current = this.userData.currentRank;

    if (current === 'Đồng') {
      this.displayedRanks = [this.allRanks['Đồng'], this.allRanks['Bạc']];
    } else if (current === 'Bạc') {
      this.displayedRanks = [this.allRanks['Bạc'], this.allRanks['Vàng']];
    } else if (current === 'Vàng') {
      this.displayedRanks = [this.allRanks['Vàng']];
    } else {
      this.displayedRanks = [];
    }
  }
}
