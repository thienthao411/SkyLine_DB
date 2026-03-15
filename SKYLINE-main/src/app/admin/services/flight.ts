import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface Flight {
  id: number;
  flightCode: string;
  airline: string;
  departure: string;
  destination: string;
  takeoffTime: {
    hour: string;
    minute: string;
    day: string;
    month: string;
    year: string;
  };
  landingTime: {
    hour: string;
    minute: string;
    day: string;
    month: string;
    year: string;
  };
  notes: string;
}

interface ApiFlight {
  id: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  date: string;
  departTime: string;
  arriveTime: string;
  seatsMax: number;
  seatsBooked: number;
}

@Injectable({
  providedIn: 'root'
})
export class FlightService {

  private dataUrl = 'assets/data/flights.json';

  constructor(private http: HttpClient) { }

  getFlights(): Observable<Flight[]> {
    return this.http.get<ApiFlight[]>(this.dataUrl).pipe(
      map(apiFlights => {
        return apiFlights.map((apiFlight, index) =>
          this.transformApiFlightToFlight(apiFlight, index)
        );
      })
    );
  }

  private transformApiFlightToFlight(apiFlight: ApiFlight, index: number): Flight {

    const parseDateTime = (isoString: string) => {
      const d = new Date(isoString);
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

      return {
        hour: pad(d.getHours()),
        minute: pad(d.getMinutes()),
        day: pad(d.getDate()),
        month: pad(d.getMonth() + 1),
        year: d.getFullYear().toString()
      };
    };

    return {
      id: index + 101,
      flightCode: apiFlight.flightNo,
      airline: apiFlight.airline,
      departure: apiFlight.from,
      destination: apiFlight.to,
      takeoffTime: parseDateTime(apiFlight.departTime),
      landingTime: parseDateTime(apiFlight.arriveTime),
      notes: `Số ghế: ${apiFlight.seatsBooked}/${apiFlight.seatsMax}`
    };
  }
}