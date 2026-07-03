import React, { useState } from 'react';

interface MockAvailabilityCalendarProps {
  onDateSelect?: (dateStr: string) => void;
  selectedDate?: string;
  allowPast?: boolean;
}

export function MockAvailabilityCalendar({ onDateSelect, selectedDate, allowPast = false }: MockAvailabilityCalendarProps) {
  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust for Monday start (0 is Sunday, so make Monday 0)
  const startingDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const renderDays = () => {
    let days = [];
    for (let i = 0; i < startingDayOffset; i++) {
      days.push(<div key={`empty-${i}`} className="py-2 text-transparent">0</div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const isPast = !allowPast && new Date(dateStr) < new Date(new Date().setHours(0,0,0,0));
      
      let style = "py-2 rounded border border-transparent text-sm ";
      let isClickable = !isPast;
      
      const dNum = parseInt(dateStr.replace(/-/g, ''), 10);
      const hash = (dNum * 13) % 100;
      const isOccupied = hash < 10;
      const isOption = hash >= 10 && hash < 15;

      if (isPast) {
        style += "bg-slate-50 text-slate-300 cursor-not-allowed";
      } else if (isOccupied) {
        style += "bg-rose-100 text-rose-700 font-bold border-rose-200 cursor-not-allowed opacity-70";
        isClickable = false;
      } else {
        style += "cursor-pointer ";
        if (selectedDate === dateStr) style += "bg-indigo-600 text-white font-bold shadow-md";
        else if (isOption) style += "bg-amber-100 text-amber-700 font-bold border-amber-200";
        else style += "bg-white hover:bg-slate-100 text-slate-700";
      }

      days.push(
        <div key={d} onClick={() => isClickable && onDateSelect && onDateSelect(dateStr)} className={style}>
          {d}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={handlePrevMonth} className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-sm">
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div className="flex gap-2">
          <select value={currentMonth} onChange={(e) => setCurrentMonth(parseInt(e.target.value))} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800">
            {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800">
            {Array.from({length: 10}, (_, i) => currentDate.getFullYear() + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={handleNextMonth} className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-sm">
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
        <div className="font-semibold text-slate-500">Lun</div><div className="font-semibold text-slate-500">Mar</div><div className="font-semibold text-slate-500">Mer</div><div className="font-semibold text-slate-500">Jeu</div><div className="font-semibold text-slate-500">Ven</div><div className="font-semibold text-slate-500">Sam</div><div className="font-semibold text-slate-500">Dim</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {renderDays()}
      </div>
      <div className="flex flex-wrap gap-4 mt-6 text-xs justify-center">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-slate-300 rounded"></div> Disponible</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-100 border border-rose-200 rounded"></div> Occupé</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div> Option</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-600 rounded"></div> Sélectionné</div>
      </div>
    </div>
  );
}
