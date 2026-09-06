import React from "react";

import { AvailabilityDatePicker } from "../components/AvailabilityDatePicker";

interface MockAvailabilityCalendarProps {
  onDateSelect?: (dateStr: string) => void;
  selectedDate?: string;
  allowPast?: boolean;
  disabledDates?: string[];
  /**
   * The calendar remains reusable for date-only forms. When enabled, it shows
   * the authoritative Titan availability preview for the selected full day.
   */
  showAvailabilityPreview?: boolean;
  /**
   * Hahitantsoa-only calendar overlay. It reads the selected venue's real
   * occupancy for the displayed month without changing Titan's rental flow.
   */
  showHahitantsoaVenueOccupancy?: boolean;
  venueName?: string;
}

export function MockAvailabilityCalendar(props: MockAvailabilityCalendarProps) {
  return (
    <AvailabilityDatePicker
      mode="inline"
      selectedDate={props.selectedDate}
      onDateSelect={props.onDateSelect}
      allowPast={props.allowPast}
      disabledDates={props.disabledDates}
      showAvailabilityPreview={props.showAvailabilityPreview}
      showHahitantsoaVenueOccupancy={props.showHahitantsoaVenueOccupancy}
      venueName={props.venueName}
    />
  );
}
