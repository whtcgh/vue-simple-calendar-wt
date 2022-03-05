<template>
	<div
		aria-label="Calendar"
		:class="[
			'cv-wrapper',
			'locale-' + CalendarMath.languageCode(displayLocale),
			'locale-' + displayLocale,
			'y' + periodStart.getFullYear(),
			'm' + CalendarMath.paddedMonth(periodStart),
			'period-' + displayPeriodUom,
			'periodCount-' + displayPeriodCount,
			{
				past: CalendarMath.isPastMonth(periodStart),
				future: CalendarMath.isFutureMonth(periodStart),
				noIntl: !CalendarMath.supportsIntl,
			},
		]"
	>
		<slot :header-props="headerProps" name="header" />
		<div class="cv-header-days">
			<div v-if="displayWeekNumbers" class="cv-weeknumber" />
			<template v-for="(label, index) in weekdayNames">
				<slot :index="getColumnDOWClass(index)" :label="label" name="dayHeader">
					<div :key="getColumnDOWClass(index)" :class="getColumnDOWClass(index)" class="cv-header-day">
						{{ label }}
					</div>
				</slot>
			</template>
		</div>
		<div :aria-multiselectable="enableDateSelection" class="cv-weeks">
			<div
				v-for="(weekStart, weekIndex) in weeksOfPeriod"
				:key="`${weekIndex}-week`"
				:class="['cv-week', 'week' + (weekIndex + 1), 'ws' + CalendarMath.isoYearMonthDay(weekStart)]"
			>
				<div v-if="displayWeekNumbers" class="cv-weeknumber">
					<slot name="weekNumber" :date="weekStart" :numberInYear="periodStartCalendarWeek + weekIndex" :numberInPeriod="weekIndex + 1"
						><span>{{ periodStartCalendarWeek + weekIndex }}</span></slot
					>
				</div>
				<div class="cv-weekdays">
					<div
						v-for="(day, dayIndex) in CalendarMath.daysOfWeek(weekStart)"
						:key="getColumnDOWClass(dayIndex)"
						:draggable="enableDateSelection"
						:class="[
							'cv-day',
							getColumnDOWClass(dayIndex),
							'd' + CalendarMath.isoYearMonthDay(day),
							'd' + CalendarMath.isoMonthDay(day),
							'd' + CalendarMath.paddedDay(day),
							'instance' + CalendarMath.instanceOfMonth(day),
							{
								today: CalendarMath.isSameDate(day, CalendarMath.today()),
								outsideOfMonth: !CalendarMath.isSameMonth(day, defaultedShowDate),
								past: CalendarMath.isInPast(day),
								future: CalendarMath.isInFuture(day),
								last: CalendarMath.isLastDayOfMonth(day),
								lastInstance: CalendarMath.isLastInstanceOfMonth(day),
								hasItems: dayHasItems(day),
								selectionStart: CalendarMath.isSameDate(day, selectionStart),
								selectionEnd: CalendarMath.isSameDate(day, selectionEnd),
							},
							...((dateClasses && dateClasses[CalendarMath.isoYearMonthDay(day)]) || []),
						]"
						:aria-grabbed="enableDateSelection ? dayIsSelected(day) : undefined"
						:aria-label="day.getDate().toString()"
						:aria-selected="dayIsSelected(day)"
						:aria-dropeffect="enableDragDrop && currentDragItem ? 'move' : enableDateSelection && dateSelectionOrigin ? 'execute' : 'none'"
						@click="onClickDay(day, $event)"
						@dragstart="onDragDateStart(day, $event)"
						@drop.prevent="onDrop(day, $event)"
						@dragover.prevent="onDragOver(day, $event)"
						@dragenter.prevent="onDragEnter(day, $event)"
						@dragleave.prevent="onDragLeave(day, $event)"
					>
						<div class="cv-day-number">{{ day.getDate() }}</div>
						<slot :day="day" name="dayContent" />
					</div>
					<template v-for="i in getWeekItems(weekStart)">
						<slot :value="i" :weekStartDate="weekStart" :top="getItemTop(i)" name="item">
							<div
								:key="i.id"
								:draggable="enableDragDrop"
								:aria-grabbed="enableDragDrop ? i == currentDragItem : undefined"
								:class="i.classes"
								:title="i.title"
								:style="`top:${getItemTop(i)};${i.originalItem.style}`"
								class="cv-item"
								@dragstart="onDragItemStart(i, $event)"
								@mouseenter="onMouseEnterItem(i, $event)"
								@mouseleave="onMouseLeaveItem(i, $event)"
								@click.stop="onClickItem(i, $event)"
								v-html="getItemTitle(i)"
							/>
						</slot>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import CalendarMath from "./CalendarMath"
import CalendarViewState from "./CalendarViewState"
import { defineComponent, PropType } from "vue"
import { ICalendarItem, INormalizedCalendarItem, DateTimeFormatOption } from "./ICalendarItem"
import { IHeaderProps } from "./IHeaderProps"

export default defineComponent({
	name: "CalendarView",

	props: {
		showDate: { type: Date, default: undefined },
		displayPeriodUom: { type: String, default: "month" },
		displayPeriodCount: { type: Number, default: 1 },
		displayWeekNumbers: { type: Boolean, default: false },
		locale: { type: String, default: undefined },
		monthNameFormat: { type: String as PropType<DateTimeFormatOption>, default: "long" },
		weekdayNameFormat: { type: String as PropType<DateTimeFormatOption>, default: "short" },
		showTimes: { type: Boolean, default: false },
		timeFormatOptions: { type: Object, default: () => {} },
		disablePast: { type: Boolean, default: false },
		disableFuture: { type: Boolean, default: false },
		enableDateSelection: { type: Boolean, default: false },
		selectionStart: { type: Date, default: null },
		selectionEnd: { type: Date, default: null },
		enableDragDrop: { type: Boolean, default: false },
		startingDayOfWeek: { type: Number, default: 0 },
		items: { type: Array as () => Array<ICalendarItem>, default: () => [] },
		dateClasses: { type: Object, default: () => {} },
		itemTop: { type: String, default: "1.4em" },
		itemContentHeight: { type: String, default: "1.4em" },
		itemBorderHeight: { type: String, default: "2px" },
		periodChangedCallback: { type: Function, default: undefined },
		currentPeriodLabel: { type: String, default: "" },
		currentPeriodLabelIcons: { type: String, default: "⇤-⇥" },
		doEmitItemMouseEvents: { type: Boolean, default: false },
	},

	emits: [
		"input",
		"period-changed",
		"click-date",
		"click-item",
		"item-mouseenter",
		"item-mouseleave",
		"drag-start",
		"drag-over-date",
		"drag-enter-date",
		"drag-leave-date",
		"drop-on-date",
		"date-selection",
		"date-selection-start",
		"date-selection-finish",
	],

	data: () => new CalendarViewState(),

	setup() {
		return { CalendarMath }
	},

	computed: {
		/*
		Props不能默认为computed/method returns，因此创建此函数的默认版本
		属性并使用它而不是裸道具(Vue Issue #6013)。
		*/
		displayLocale(): string {
			return this.locale || CalendarMath.getDefaultBrowserLocale()
		},

		/*
		ShowDate，但默认为今天。以下开始和为
		“外部月” class。任何作为showDate的一部分传递的时间组件都会被丢弃。
		*/
		defaultedShowDate(): Date {
			if (this.showDate) return CalendarMath.dateOnly(this.showDate)
			return CalendarMath.today()
		},

		/*
		给定默认为今天的showDate，计算时间段的开始和结束
		日期正好在。
		*/
		periodStart(): Date {
			return CalendarMath.beginningOfPeriod(this.defaultedShowDate, this.displayPeriodUom, this.startingDayOfWeek)
		},

		periodEnd(): Date {
			return CalendarMath.addDays(CalendarMath.incrementPeriod(this.periodStart, this.displayPeriodUom, this.displayPeriodCount), -1)
		},

		periodStartCalendarWeek(): number {
			const firstWeekStarts = CalendarMath.beginningOfWeek(CalendarMath.beginningOfPeriod(this.periodStart, "year", 0), this.startingDayOfWeek)
			const periodWeekStarts = CalendarMath.beginningOfWeek(this.periodStart, this.startingDayOfWeek)
			return 1 + Math.floor(CalendarMath.dayDiff(firstWeekStarts, periodWeekStarts) / 7)
		},

		/*
		对于月和年视图，网格中显示的第一个和最后一个日期可能不是
		与预期周期相同，因为周期可能不均匀开始和停止
		在一周的第一天。
		*/
		displayFirstDate(): Date {
			return CalendarMath.beginningOfWeek(this.periodStart, this.startingDayOfWeek)
		},

		displayLastDate(): Date {
			return CalendarMath.endOfWeek(this.periodEnd, this.startingDayOfWeek)
		},

		/*
		创建一个日期数组，其中每个日期表示一周的开始
		应在当前时期的视图中呈现。
		*/
		weeksOfPeriod(): Array<Date> {
			//返回一个表示每周开始日期的对象数组
			//视图中包含的。
			const numWeeks = Math.floor((CalendarMath.dayDiff(this.displayFirstDate, this.displayLastDate) + 1) / 7)
			return [...Array(numWeeks)].map((_, i) => CalendarMath.addDays(this.displayFirstDate, i * 7))
		},

		// 根据当前的区域设置和格式设置缓存名称
		monthNames(): Array<string> {
			return CalendarMath.getFormattedMonthNames(this.displayLocale, this.monthNameFormat)
		},

		weekdayNames(): Array<string> {
			return CalendarMath.getFormattedWeekdayNames(this.displayLocale, this.weekdayNameFormat, this.startingDayOfWeek)
		},

		// 确保所有项目属性都有合适的默认值
		fixedItems(): Array<INormalizedCalendarItem> {
			const self = this
			if (!this.items) return []
			return this.items.map((item) => CalendarMath.normalizeItem(item, item.id === self.currentHoveredItemId))
		},

		// 今天日期所在的时间段
		currentPeriodStart(): Date {
			return CalendarMath.beginningOfPeriod(CalendarMath.today(), this.displayPeriodUom, this.startingDayOfWeek)
		},

		currentPeriodEnd(): Date {
			return CalendarMath.addDays(CalendarMath.incrementPeriod(this.currentPeriodStart, this.displayPeriodUom, this.displayPeriodCount), -1)
		},

		// 创建HTML来呈现日历标题的日期范围。
		periodLabel(): string {
			return CalendarMath.formattedPeriod(this.periodStart, this.periodEnd, this.displayPeriodUom, this.monthNames)
		},

		currentPeriodLabelFinal(): string {
			const c = this.currentPeriodStart
			const s = this.periodStart
			if (!this.currentPeriodLabel) return CalendarMath.formattedPeriod(c, this.currentPeriodEnd, this.displayPeriodUom, this.monthNames)
			if (this.currentPeriodLabel === "icons") return this.currentPeriodLabelIcons[Math.sign(c.getTime() - s.getTime()) + 1]
			return this.currentPeriodLabel
		},

		headerProps(): IHeaderProps {
			return {
				// Dates for UI 导航
				previousYear: this.getIncrementedPeriod(-12),
				previousPeriod: this.getIncrementedPeriod(-1),
				nextPeriod: this.getIncrementedPeriod(1),
				previousFullPeriod: this.getIncrementedPeriod(-this.displayPeriodCount),
				nextFullPeriod: this.getIncrementedPeriod(this.displayPeriodCount),
				nextYear: this.getIncrementedPeriod(12),
				currentPeriod: this.currentPeriodStart,
				currentPeriodLabel: this.currentPeriodLabelFinal,
				// Dates for header display
				periodStart: this.periodStart,
				periodEnd: this.periodEnd,
				// 可能对自定义标头有用的额外信息
				displayLocale: this.displayLocale,
				displayFirstDate: this.displayFirstDate,
				displayLastDate: this.displayLastDate,
				monthNames: this.monthNames,
				fixedItems: this.fixedItems,
				periodLabel: this.periodLabel,
			}
		},

		periodRange() {
			return {
				periodStart: this.periodStart,
				periodEnd: this.periodEnd,
				displayFirstDate: this.displayFirstDate,
				displayLastDate: this.displayLastDate,
			}
		},
	},

	watch: {
		periodRange: {
			immediate: true,
			handler(newVal) {
				if (this.periodChangedCallback) {
					this.$emit("period-changed")
					this.periodChangedCallback(newVal, "watch")
				}
			},
		},
	},

	methods: {
		// ******************************
		// UI Events
		// ******************************

		onClickDay(day: Date, windowEvent: Event): void {
			if (this.disablePast && CalendarMath.isInPast(day)) return
			if (this.disableFuture && CalendarMath.isInFuture(day)) return
			this.$emit("click-date", day, this.findAndSortItemsInDateRange(day, day), windowEvent)
		},

		onClickItem(calendarItem: ICalendarItem, windowEvent: Event): void {
			this.$emit("click-item", calendarItem, windowEvent)
		},

		/*
		The day name header 需要知道类分配的dow，这个值应该
		不根据startdayofweek(即，Sunday总是0)更改
		计算给定日指数的道琼斯指数。
		*/
		getColumnDOWClass(dayIndex: number): string {
			return "dow" + ((dayIndex + this.startingDayOfWeek) % 7)
		},

		// ******************************
		// Date 周期
		// ******************************

		/*
		返回当前显示日期向前或向后移动给定日期的日期
		当前显示单元的数量。如果move结果为a，则返回null
		不允许显示时间。
		*/
		getIncrementedPeriod(count: number): Date | null {
			const newStartDate = CalendarMath.incrementPeriod(this.periodStart, this.displayPeriodUom, count)
			const newEndDate = CalendarMath.incrementPeriod(newStartDate, this.displayPeriodUom, this.displayPeriodCount)
			if (this.disablePast && newEndDate <= CalendarMath.today()) return null
			if (this.disableFuture && newStartDate > CalendarMath.today()) return null
			return newStartDate
		},

		// ******************************
		// Hover items (#95, #136)
		// ******************************

		onMouseEnterItem(calendarItem: ICalendarItem, windowEvent: Event): void {
			this.currentHoveredItemId = calendarItem.id
			if (this.doEmitItemMouseEvents) {
				this.$emit("item-mouseenter", calendarItem, windowEvent)
			}
		},

		onMouseLeaveItem(calendarItem: ICalendarItem, windowEvent: Event): void {
			this.currentHoveredItemId = ""
			if (this.doEmitItemMouseEvents) {
				this.$emit("item-mouseleave", calendarItem, windowEvent)
			}
		},

		// ******************************
		// 拖拽时间(选择)
		// ******************************

		onDragDateStart(day: Date, windowEvent: DragEvent): boolean {
			if (!this.enableDateSelection) return false
			//将选择开始的日期推送到datattransfer。这个组件不使用它，但是
			//一个值需要在Firefox和可能的其他浏览器。
			windowEvent.dataTransfer?.setData("text", day.toString())
			let img = new Image()
			img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
			windowEvent.dataTransfer?.setDragImage(img, 10, 10)
			this.dateSelectionOrigin = day
			this.emitDateSelection("date-selection-start", day, windowEvent)
			return true
		},

		// ******************************
		// 拖拽 and drop items
		// ******************************

		onDragItemStart(calendarItem: INormalizedCalendarItem, windowEvent: DragEvent): boolean {
			if (!this.enableDragDrop) return false
			// Firefox和其他可能的浏览器需要设置datattransfer，即使这个值没有被使用。IE11
			//要求第一个参数完全是“text”(而不是“text/plain”，等等)。日历项的ID为
			//传入，允许调用应用程序接收拖出组件的项。
			windowEvent.dataTransfer?.setData("text", calendarItem.id)
			//但是，我们在组件中不使用dattransfer。相反，我们只是对项目进行处理
			//当前被拖动。这样可以避免以后查找。
			this.currentDragItem = calendarItem
			//重置日期选择原点，这样onenter事件就不会混淆
			this.dateSelectionOrigin = null
			//允许调用程序添加额外的功能。
			this.$emit("drag-start", calendarItem, windowEvent)
			return true
		},

		handleDragEvent(bubbleEventName: "drag-over-date" | "drag-enter-date" | "drag-leave-date" | "drop-on-date", bubbleParam: any, windowEvent: Event): boolean {
			if (!this.enableDragDrop) return false
			//如果用户将一个项目从这个日历拖到这个日历，currentDragItem将被初始化为
			//最近的dragStart事件。如果没有，我们仍然发出事件，调用者将需要
			//根据第三个参数(windowwevent，这给他们访问' datattransfer ')来决定做什么。
			//这允许开发者创建自定义日历，其中的东西可以从外部拖进来。这
			//也允许开发人员使用有范围的槽来处理项目本身的拖放。
			this.$emit(bubbleEventName, this.currentDragItem, bubbleParam, windowEvent)
			return true
		},

		onDragOver(day: Date, windowEvent: Event): void {
			this.handleDragEvent("drag-over-date", day, windowEvent)
		},

		onDragEnter(day: Date, windowEvent: Event) {
			if (this.enableDateSelection && this.dateSelectionOrigin) {
				// User is selecting dates, not items.
				this.emitDateSelection("date-selection", day, windowEvent)
				return
			}
			if (!this.handleDragEvent("drag-enter-date", day, windowEvent)) return
			const el = windowEvent.target as HTMLElement
			el.classList.add("draghover")
		},

		onDragLeave(day: Date, windowEvent: Event): void {
			// 用户正在选择日期，而不是 Items。没有发出。
			if (this.enableDateSelection && this.selectionStart) return
			if (!this.handleDragEvent("drag-leave-date", day, windowEvent)) return
			const el = windowEvent.target as HTMLElement
			el.classList.remove("draghover")
		},

		onDrop(day: Date, windowEvent: Event): void {
			if (this.enableDateSelection && this.dateSelectionOrigin) {
				//用户正在选择日期，而不是 Items
				this.emitDateSelection("date-selection-finish", day, windowEvent)
				return
			}
			if (!this.handleDragEvent("drop-on-date", day, windowEvent)) return
			const el = windowEvent.target as HTMLElement
			el.classList.remove("draghover")
		},

		emitDateSelection(eventName: "date-selection" | "date-selection-start" | "date-selection-finish", toDate: Date, windowEvent: Event): void {
			if (!this.dateSelectionOrigin) return
			this.$emit(eventName, toDate <= this.dateSelectionOrigin ? [toDate, this.dateSelectionOrigin, windowEvent] : [this.dateSelectionOrigin, toDate, windowEvent])
		},

		// ******************************
		// 日历 Items
		// ******************************

		itemComparer(a: INormalizedCalendarItem, b: INormalizedCalendarItem) {
			if (a.startDate < b.startDate) return -1
			if (b.startDate < a.startDate) return 1
			if (a.endDate > b.endDate) return -1
			if (b.endDate > a.endDate) return 1
			return a.id < b.id ? -1 : 1
		},

		findAndSortItemsInWeek(weekStart: Date): Array<INormalizedCalendarItem> {
			//返回包含给定一周的任意部分的项目列表。
			return this.findAndSortItemsInDateRange(weekStart, CalendarMath.addDays(weekStart, 6))
		},

		findAndSortItemsInDateRange(startDate: Date, endDate: Date): Array<INormalizedCalendarItem> {
			//返回包含日期范围内任意一天的项目列表，
			// include，排序后，开始时间较早的项将首先返回。
			return this.fixedItems.filter((item) => item.endDate >= startDate && CalendarMath.dateOnly(item.startDate) <= endDate, this).sort(this.itemComparer)
		},

		dayHasItems(day: Date): boolean {
			return !!this.fixedItems.find((d) => d.endDate >= day && CalendarMath.dateOnly(d.startDate) <= day)
		},

		dayIsSelected(day: Date): boolean {
			if (!this.selectionStart || !this.selectionEnd) return false
			if (day < CalendarMath.dateOnly(this.selectionStart)) return false
			if (day > CalendarMath.dateOnly(this.selectionEnd)) return false
			return true
		},

		getWeekItems(weekStart: Date): Array<INormalizedCalendarItem> {
			//返回包含从某天开始的一周的项目列表。
			//排序，所以开始较早的项目总是显示在前面。
			const items = this.findAndSortItemsInWeek(weekStart)
			const results = []
			const itemRows: Array<Array<boolean>> = [[], [], [], [], [], [], []]
			for (let i = 0; i < items.length; i++) {
				const ep = Object.assign({}, items[i], {
					classes: [...items[i].classes],
					itemRow: 0,
				})
				const continued = ep.startDate < weekStart
				const startOffset = continued ? 0 : CalendarMath.dayDiff(weekStart, ep.startDate)
				const span = Math.min(7 - startOffset, CalendarMath.dayDiff(CalendarMath.addDays(weekStart, startOffset), ep.endDate) + 1)
				if (continued) ep.classes.push("continued")
				if (CalendarMath.dayDiff(weekStart, ep.endDate) > 6) ep.classes.push("toBeContinued")
				if (CalendarMath.isInPast(ep.endDate)) ep.classes.push("past")
				if (ep.originalItem.url) ep.classes.push("hasUrl")
				for (let d = 0; d < 7; d++) {
					if (d === startOffset) {
						let s = 0
						while (itemRows[d][s]) s++
						ep.itemRow = s
						itemRows[d][s] = true
					} else if (d < startOffset + span) {
						itemRows[d][ep.itemRow] = true
					}
				}
				ep.classes.push(`offset${startOffset}`)
				ep.classes.push(`span${span}`)
				results.push(ep)
			}
			return results
		},

		/*
		创建HTML来为项目标题添加前缀，显示项目的开始和/或
		结束时间。不显示午夜。
		*/
		getFormattedTimeRange(item: INormalizedCalendarItem): string {
			const startTime = '<span class="startTime">' + CalendarMath.formattedTime(item.startDate, this.displayLocale, this.timeFormatOptions) + "</span>"
			let endTime = ""
			if (!CalendarMath.isSameDateTime(item.startDate, item.endDate)) {
				endTime =
					'<span class="endTime">' +
					CalendarMath.formattedTime(item.endDate, this.displayLocale, this.timeFormatOptions) + "</span>"
			}
			return startTime + endTime
		},

		getItemTitle(item: INormalizedCalendarItem): string {
			if (!this.showTimes) return item.title
			return this.getFormattedTimeRange(item) + " " + item.title
		},

		getItemTop(item: INormalizedCalendarItem): string {
			//在给定的周内，根据指定的行计算项目的顶部位置。
			const r = item.itemRow
			const h = this.itemContentHeight
			const b = this.itemBorderHeight
			return `calc(${this.itemTop} + ${r}*${h} + ${r}*${b})`
		},
	},

	setup() {
		return { CalendarMath }
	},

})
</script>
<!--

下面的CSS仅代表正确呈现(定位等)和所需的CSS
最低限度的默认边框和颜色。节日的颜色，节日的表情符号，物品的颜色，
像边框半径这样的装饰应该是主题的一部分。样式相关的默认
header在CalendarViewHeader组件中。

-->
<style>
/* Position/Flex */

/* 让日历垂直伸缩 */
.cv-wrapper {
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	height: 100%;
	min-height: 100%;
	max-height: 100%;
	overflow-x: hidden;
	overflow-y: hidden;
}

.cv-wrapper,
.cv-wrapper div {
	box-sizing: border-box;
	line-height: 1em;
	font-size: 1em;
}

.cv-header-days {
	display: flex;
	flex-grow: 0;
	flex-shrink: 0;
	flex-basis: auto;
	flex-flow: row nowrap;
	border-width: 0 0 0 1px;
}

.cv-header-day {
	display: flex;
	flex-grow: 1;
	flex-shrink: 0;
	flex-basis: 0;
	flex-flow: row nowrap;
	align-items: center;
	justify-content: center;
	text-align: center;
	border-width: 1px 1px 0 0;
}

/* 日历网格应该占据剩余的垂直空间 */
.cv-weeks {
	display: flex;
	flex-grow: 1;
	flex-shrink: 1;
	flex-basis: auto;
	flex-flow: column nowrap;
	border-width: 0 0 1px 1px;

	/* 允许网格滚动，如果有可能几周无法适应视图 */
	overflow-y: auto;
	-ms-overflow-style: none;
}

.cv-weeknumber {
	width: 2rem;
	position: relative;
	text-align: center;
	border-width: 1px 1px 0 0;
	border-style: solid;
	line-height: 1;
}

/* 使用弹性基础0周行，所以所有周将是相同的高度，无论内容 */
.cv-week {
	display: flex;

	/* 简写flex: 1 10 0不支持IE11 */
	flex-grow: 1;
	flex-shrink: 1;
	flex-basis: 0;
	flex-flow: row nowrap;
	min-height: 3em;
	border-width: 0;

	/* 允许周项目滚动，如果他们太高 */
	position: relative;
	width: 100%;
	overflow-y: auto;
	-ms-overflow-style: none;
}

.cv-weekdays {
	display: flex;

	/* 简写flex: 1 10 0不支持IE11 */
	flex-grow: 1;
	flex-shrink: 0;
	flex-basis: 0;
	flex-flow: row nowrap;

	/* 即使用户的语言是RTL(#138)，一周的天数也从左往右排列 */
	direction: ltr;
	position: relative;
	overflow-y: auto;
}

.cv-day {
	display: flex;

	/* 简写flex: 1 10 0不支持IE11 */
	flex-grow: 1;
	flex-shrink: 0;
	flex-basis: 0;
	position: relative; /* 支持IE11，它不支持sticky */
	position: sticky; /* 当滚动星期的项目时，保持固定的日期内容 */
	top: 0;
	border-width: 1px 1px 0 0;

	/* 恢复用户方向设置(覆盖一周) */
	direction: initial;
}

.cv-day-number {
	height: auto;
	align-self: flex-start;
}

/*
微软Edge 41 (EdgeHTML 16)有一个bug(#109)，其中天“消失”了，因为它们本来就是
在接下来的一周(尽管在简历周上有“nowrap”)。这似乎是一个特别的问题
我们的指标和粘性定位。我无法在Edge 38、42或44中重现这个问题。
我不愿关闭所有Edge用户的粘性功能，因为一个版本(或者一个
该版本与特定图形适配器或其他设置的交互)。所以我把这个留在这里
作为一个例子，任何被迫支持Edge 41的人可能会看到同样的问题。如果是这样的话，就
把这个选择器添加到你自己的CSS中。

@supports (-ms-ime-align: auto) {
	.cv-day {
		position: relative;
	}
}
_:-ms-lang(x),
.cv-day {
	position: relative;
}
.cv-day-number {
	position: absolute;
	right: 0;
}
*/

.cv-day[draggable],
.cv-item[draggable] {
	user-select: none;
}

.cv-item {
	position: absolute;
	white-space: nowrap;
	overflow: hidden;
	background-color: #f7f7f7;
	border-width: 1px;

	/* 恢复用户方向设置(覆盖一周) */
	direction: initial;
}

/* 在悬停时Wrap显示整个项目标题 */
.cv-wrapper.wrap-item-title-on-hover .cv-item:hover {
	white-space: normal;
	z-index: 1;
}

/* Colors */

.cv-header-days,
.cv-header-day,
.cv-weeks,
.cv-week,
.cv-day,
.cv-item {
	border-style: solid;
	border-color: #ddd;
}

/* Item Times */
.cv-item .endTime::before {
	content: "-";
}

/* Internal Metrics */
.cv-header-day,
.cv-day-number,
.cv-item {
	padding: 0.2em;
}

/* 允许表情符号图标或标签(如节日)更容易添加到特定日期，通过设置边距。 */
.cv-day-number::before {
	margin-right: 0.5em;
}

.cv-item.offset0 {
	left: 0;
}

.cv-item.offset1 {
	left: calc((100% / 7));
}

.cv-item.offset2 {
	left: calc((200% / 7));
}

.cv-item.offset3 {
	left: calc((300% / 7));
}

.cv-item.offset4 {
	left: calc((400% / 7));
}

.cv-item.offset5 {
	left: calc((500% / 7));
}

.cv-item.offset6 {
	left: calc((600% / 7));
}

/* 跨越日期的项的度量 */

.cv-item.span1 {
	width: calc((100% / 7) - 0.05em);
}

.cv-item.span2 {
	width: calc((200% / 7) - 0.05em);
}

.cv-item.span3 {
	width: calc((300% / 7) - 0.05em);
}

.cv-item.span4 {
	width: calc((400% / 7) - 0.05em);
}

.cv-item.span5 {
	width: calc((500% / 7) - 0.05em);
}

.cv-item.span6 {
	width: calc((600% / 7) - 0.05em);
}

.cv-item.span7 {
	width: calc((700% / 7) - 0.05em);
}

/* 隐藏网格和星期的滚动条 */
.cv-weeks::-webkit-scrollbar,
.cv-week::-webkit-scrollbar {
	width: 0; /* remove 滚动条 space */
	background: transparent; /* 可选:只是让滚动条不可见 */
}
</style>
