export class SkyblockDate {
	static SkyblockEpochSeconds = 1560275700;
	declare Year: number;
	declare Month: number;
	declare Day: number;
	declare UnixSeconds: number;

	get ElapsedSeconds() {
		return this.UnixSeconds - SkyblockDate.SkyblockEpochSeconds;
	}

	constructor(unixSeconds: number) {
		this.UnixSeconds = unixSeconds;
		const timeElapsed = unixSeconds - SkyblockDate.SkyblockEpochSeconds;
		const days = timeElapsed / 1200;

		const month = Math.floor((days % 372) / 31);
		const day = Math.floor((days % 372) % 31);

		this.Year = Math.floor(days / 372);
		this.Month = month;
		this.Day = day;
	}

	get MonthName() {
		return GetSkyblockMonthName(this.Month);
	}

	get DayName() {
		return GetDayWithSuffix(this.Day + 1);
	}

	get Readable() {
		return `${this.MonthName} ${this.DayName}, Year ${this.Year + 1}`;
	}
}

export function GetSkyblockDate(unixSeconds: number) {
	return new SkyblockDate(unixSeconds);
}

export function GetReadableDate(unixSeconds: number) {
	return GetSkyblockDate(unixSeconds).Readable;
}

export function GetDayWithSuffix(day: number) {
	const j = day % 10;
	const k = day % 100;

	if (j == 1 && k != 11) return day + 'st';
	if (j == 2 && k != 12) return day + 'nd';
	if (j == 3 && k != 13) return day + 'rd';

	return day + 'th';
}

export function GetSkyblockMonthName(month: number) {
	const months = [
		'Early Spring',
		'Spring',
		'Late Spring',
		'Early Summer',
		'Summer',
		'Late Summer',
		'Early Autumn',
		'Autumn',
		'Late Autumn',
		'Early Winter',
		'Winter',
		'Late Winter',
	];

	return months[month] ?? 'Unknown';
}
