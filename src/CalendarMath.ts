import { ICalendarItem, INormalizedCalendarItem, DateTimeFormatOption } from "./ICalendarItem"

/*
***********************************************************
这包括在显示日历时有用的方法。它没有状态。
***********************************************************
*/
export default {
	// ******************************
	// Series
	// ******************************

	today(): Date {
		return this.dateOnly(new Date())
	},

	beginningOfPeriod(d: Date, periodUom: string, startDow: number): Date {
		switch (periodUom) {
			case "year":
				return new Date(d.getFullYear(), 0)
			case "month":
				return new Date(d.getFullYear(), d.getMonth())
			case "week":
				return this.beginningOfWeek(d, startDow)
			default:
				return d
		}
	},

	daysOfWeek(weekStart: Date): Array<Date> {
		return [...Array(7)].map((_, i) => this.addDays(weekStart, i))
	},

	// ********************************************
	// 日期转换,保持每天的时间
	// ********************************************

	addDays(d: Date, days: number): Date {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds())
	},

	beginningOfWeek(d: Date, startDow: number): Date {
		return this.addDays(d, (startDow - d.getDay() - 7) % -7)
	},
	endOfWeek(d: Date, startDow: number): Date {
		return this.addDays(this.beginningOfWeek(d, startDow), 7)
	},

	// ********************************************
	// Date转换忽略/删除一天中的时间
	// ********************************************
	beginningOfMonth: (d: Date): Date => new Date(d.getFullYear(), d.getMonth()),

	instanceOfMonth: (d: Date): number => Math.ceil(d.getDate() / 7),

	//这个函数增量由给定的日期单位一个日期。接受单位为:年、月、周。一年又一个月，
	//当月的日期不变。如果单位为“月”而起始日期为“月”，这可能会导致意想不到的结果
	//高于目的月的天数。计数可以是正的也可以是负的。
	incrementPeriod(d: Date, uom: string, count: number) {
		return new Date(d.getFullYear() + (uom == "year" ? count : 0), d.getMonth() + (uom == "month" ? count : 0), d.getDate() + (uom == "week" ? count * 7 : 0))
	},

	// ******************************
	// Date 格式化
	// ******************************

	paddedMonth: (d: Date): string => ("0" + String(d.getMonth() + 1)).slice(-2),
	paddedDay: (d: Date): string => ("0" + String(d.getDate())).slice(-2),

	isoYearMonth(d: Date): string {
		return d.getFullYear() + "-" + this.paddedMonth(d)
	},
	isoYearMonthDay(d: Date): string {
		return this.isoYearMonth(d) + "-" + this.paddedDay(d)
	},
	isoMonthDay(d: Date): string {
		return this.paddedMonth(d) + "-" + this.paddedDay(d)
	},
	formattedTime(d: Date, locale: string, options?: Intl.DateTimeFormatOptions | undefined): string {
		// Assume midnight = "all day" or 不确定的 time
		if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) return ""
		// 如果不支持Intl，则发送回以当地时间表示的24小时、加零的小时和分钟。
		if (!this.supportsIntl()) {
			var ms = new Date().getTimezoneOffset() * 60000 // TZ offset in milliseconds
			return new Date(d.getTime() - ms).toISOString().slice(11, 16)
		}
		return d.toLocaleTimeString(locale, options)
	},

	// Formats a date period in long English style. Examples supported:
	// May 2018
	// May – June 2018
	// December 2018 – January 2019
	// May 6 – 26, 2018
	// May 13 – June 2, 2018
	// December 16, 2018 – January 5, 2019
	formattedPeriod(startDate: Date, endDate: Date, periodUom: string, monthNames: Array<string>) {
		const singleYear = startDate.getFullYear() === endDate.getFullYear()
		const singleMonth = this.isSameMonth(startDate, endDate)
		const isYear = periodUom === "year"
		const isMonth = periodUom === "month"
		const isWeek = !isYear && !isMonth

		let s = []
		s.push(monthNames[startDate.getMonth()])
		if (isWeek) {
			s.push(" ")
			s.push(startDate.getDate())
		}
		if (!singleYear) {
			s.push(isWeek ? ", " : " ")
			s.push(startDate.getFullYear())
		}
		if (!singleMonth || !singleYear) {
			s.push(" \u2013 ")
			if (!singleMonth) {
				s.push(monthNames[endDate.getMonth()])
			}
			if (isWeek) s.push(" ")
		} else if (isWeek) {
			s.push(" \u2013 ")
		}
		if (isWeek) {
			s.push(endDate.getDate())
			s.push(", ")
		} else {
			s.push(" ")
		}
		s.push(endDate.getFullYear())
		return s.join("")
	},

	// ******************************
	// Date 比较
	// ******************************

	// 两个日期之间的天数。 如果是现在，一天中的时间被忽略。
	// 将日期视为UTC，以避免DST在时间段内的变化导致错误的答案(#150)。
	dayDiff(d1: Date, d2: Date): number {
		const endDate = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()),
			startDate = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())
		return (endDate - startDate) / 86400000
	},

	isSameDate(d1: Date, d2: Date): boolean {
		// http://stackoverflow.com/questions/492994/compare-two-dates-with-javascript
		return d1 && d2 && this.dayDiff(d1, d2) === 0
	},

	isSameDateTime: (d1: Date, d2: Date): boolean => d1 && d2 && d1.getTime() === d2.getTime(),
	isSameMonth: (d1: Date, d2: Date): boolean => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth(),

	isPastMonth(d: Date): boolean {
		return this.beginningOfMonth(d) < this.beginningOfMonth(this.today())
	},
	isFutureMonth(d: Date): boolean {
		return this.beginningOfMonth(d) > this.beginningOfMonth(this.today())
	},

	isInFuture(d: Date): boolean {
		return this.dateOnly(d) > this.today()
	},
	isInPast(d: Date): boolean {
		return this.dateOnly(d) < this.today()
	},
	isLastInstanceOfMonth(d: Date): boolean {
		return d.getMonth() !== this.addDays(d, 7).getMonth()
	},
	isLastDayOfMonth(d: Date): boolean {
		return d.getMonth() !== this.addDays(d, 1).getMonth()
	},

	fromIsoStringToLocalDate(s: string): Date {
		let d = [...Array(7)].map((_) => 0)
		s.split(/\D/, 7).forEach((s, i) => (d[i] = Number(s)))
		d[1]-- // adjust month
		return new Date(d[0], d[1], d[2], d[3], d[4], d[5], d[6])
	},

	toLocalDate(d: any): Date {
		return typeof d === "string" ? this.fromIsoStringToLocalDate(d) : new Date(d)
	},

	dateOnly(d: Date | string): Date {
		// 总是使用副本，setHours会改变参数
		const d2 = new Date(d)
		d2.setHours(0, 0, 0, 0)
		return d2
	},

	// ******************************
	// Localization
	// ******************************

	languageCode: (l: string): string => l.substring(0, 2),

	supportsIntl: (): boolean => typeof Intl !== "undefined",

	getFormattedMonthNames(locale: string, format: DateTimeFormatOption): Array<string> {
		// 如果可能的话，使用提供的区域设置和格式来获取月份的名称
		if (!this.supportsIntl()) return [...Array(12)].map((_) => "")
		const formatter = new Intl.DateTimeFormat(locale, { month: format })
		// 哪一年不重要，就用2017年吧
		return [...Array(12)].map((_, i) => formatter.format(new Date(2017, i, 1)))
	},

	getFormattedWeekdayNames(locale: string, format: DateTimeFormatOption, startingDayOfWeek: number): Array<string> {
		// 如果可能的话，使用提供的区域设置和格式来获取星期几的名称
		if (!this.supportsIntl()) return [...Array(7)].map((_) => "")
		const formatter = new Intl.DateTimeFormat(locale, { weekday: format })
		// 2017年开始于周日，所以用它作为基准日期
		return [...Array(7)].map((_, i) => formatter.format(new Date(2017, 0, (i + 1 + startingDayOfWeek) % 7)))
	},

	getDefaultBrowserLocale(): string {
		// 如果不是在浏览器中运行，无法确定默认值，则返回未知代码(空白无效)
		if (typeof navigator === "undefined") return "unk"
		// 返回浏览器的语言设置，实现是特定的浏览器
		return (navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language).toLowerCase()
	},

	// ******************************
	// Calendar Items
	// ******************************
	normalizeItem(item: ICalendarItem, isHovered: boolean): INormalizedCalendarItem {
		//从版本6开始，类必须是字符串数组
		//类可能是一个字符串, 一个数组, 或null。归一化到一个数组
		const itemClasses = item.classes ? [...item.classes] : []
		// 当某部分悬停时，支持整个项目的伪悬停
		if (isHovered) itemClasses.push("isHovered")
		return {
			originalItem: item,
			startDate: this.toLocalDate(item.startDate),
			// 对于没有结束日期的项，结束日期为开始日期
			endDate: this.toLocalDate(item.endDate || item.startDate),
			classes: itemClasses,
			// 没有标题的项目是无标题的
			title: item.title || "Untitled",
			// 需要一个ID。自动生成会导致奇怪的错误，因为它们被用作键并在项中传递
			id: item.id,
			// Pass the URL along 传递URL
			url: item.url,
		}
	},
}
