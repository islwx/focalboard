// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import FullCalendar, {EventClickArg, EventChangeArg, EventInput, EventContentArg} from '@fullcalendar/react'

import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'

import mutator from '../../mutator'

import {IPropertyTemplate} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {DateProperty, createDatePropertyFromString} from '../properties/dateRange/dateRange'

import './fullcalendar.scss'

const oneDay = 60 * 60 * 24 * 1000

type Props = {
    cards: Card[]
    initialDate?: Date
    dateDisplayProperty?: IPropertyTemplate
    showCard: (cardId: string) => void
    addCard: (properties: Record<string, string>) => void
}

function createDatePropertyFromCalendarDates(start: Date, end: Date) : DateProperty {
    // save as noon local, expected from the date picker
    start.setHours(12)
    const dateFrom = start.getTime() - timeZoneOffset(start.getTime())
    end.setHours(12)
    const dateTo = end.getTime() - timeZoneOffset(end.getTime()) - oneDay // subtract one day. Calendar is date exclusive

    const dateProperty : DateProperty = {from: dateFrom}
    if (dateTo !== dateFrom) {
        dateProperty.to = dateTo
    }
    return dateProperty
}

const timeZoneOffset = (date: number): number => {
    return new Date(date).getTimezoneOffset() * 60 * 1000
}

const CalendarFullView = (props: Props): JSX.Element|null => {
    const intl = useIntl()
    const {cards, dateDisplayProperty} = props
    let {initialDate} = props
    if (!initialDate) {
        initialDate = new Date()
    }

    const isEditable = () : boolean => {
        if (!dateDisplayProperty || (dateDisplayProperty.type === 'createdTime' || dateDisplayProperty.type === 'updatedTime')) {
            return false
        }
        return true
    }

    const myEventsList = props.cards.flatMap((card): EventInput[] => {
        let dateFrom = new Date(card.createAt || 0)
        let dateTo = new Date(card.createAt || 0)
        if (dateDisplayProperty && dateDisplayProperty?.type === 'updatedTime') {
            dateFrom = new Date(card.updateAt || 0)
            dateTo = new Date(card.updateAt || 0)
        } else if (dateDisplayProperty && dateDisplayProperty?.type !== 'createdTime') {
            const dateProperty = createDatePropertyFromString(card.fields.properties[dateDisplayProperty.id || ''] as string)
            if (!dateProperty.from) {
                return []
            }

            // date properties are stored as 12 pm UTC, convert to 12 am (00) UTC for calendar
            dateFrom = dateProperty.from ? new Date(dateProperty.from + (dateProperty.includeTime ? 0 : timeZoneOffset(dateProperty.from))) : new Date()
            dateFrom.setHours(0, 0, 0, 0)
            const dateToNumber = dateProperty.to ? dateProperty.to + (dateProperty.includeTime ? 0 : timeZoneOffset(dateProperty.to)) : dateFrom.getTime()
            dateTo = new Date(dateToNumber + oneDay) // Add one day.
            dateTo.setHours(0, 0, 0, 0)
        }
        return [{
            id: card.id,
            title: card.title,
            extendedProps: {icon: card.fields.icon},
            properties: card.fields.properties,
            allDay: true,
            start: dateFrom,
            end: dateTo,
        }]
    })

    const renderEventContent = (eventProps: EventContentArg): JSX.Element|null => {
        const {event} = eventProps
        return (
            <div className='octo-icontitle'>
                { event.extendedProps.icon ? <div className='octo-icon'>{event.extendedProps.icon}</div> : undefined }
                <div
                    className='fc-event-title'
                    key='__title'
                >{event.title || intl.formatMessage({id: 'KanbanCard.untitled', defaultMessage: 'Untitled'})}</div>
            </div>
        )
    }

    const eventClick = (eventProps: EventClickArg) => {
        const {event} = eventProps
        props.showCard(event.id)
    }

    const eventChange = (eventProps: EventChangeArg) => {
        const {event} = eventProps
        if (!event.start) {
            return
        }
        if (!event.end) {
            return
        }

        const startDate = new Date(event.start.getTime())
        const endDate = new Date(event.end.getTime())
        const dateProperty = createDatePropertyFromCalendarDates(startDate, endDate)
        const card = cards.find((o) => o.id === event.id)
        if (card && dateDisplayProperty) {
            mutator.changePropertyValue(card, dateDisplayProperty.id, JSON.stringify(dateProperty))
        }
    }

    const onNewEvent = (args: {start: Date, end: Date}) => {
        const dateProperty = createDatePropertyFromCalendarDates(args.start, args.end)

        const properties: Record<string, string> = {}
        if (dateDisplayProperty) {
            properties[dateDisplayProperty.id] = JSON.stringify(dateProperty)
        }

        props.addCard(properties)
    }

    const toolbar = {
        left: 'title',
        center: '',
        right: 'dayGridWeek dayGridMonth prev,today,next',
    }

    const buttonText = {
        today: intl.formatMessage({id: 'calendar.today', defaultMessage: 'TODAY'}),
        month: intl.formatMessage({id: 'calendar.month', defaultMessage: 'Month'}),
        week: intl.formatMessage({id: 'calendar.week', defaultMessage: 'Week'}),
    }

    return (
        <div
            className='CalendarContainer'
        >
            <FullCalendar
                initialDate={initialDate}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView='dayGridMonth'
                events={myEventsList}
                editable={isEditable()}
                headerToolbar={toolbar}
                buttonText={buttonText}
                eventClick={eventClick}
                eventContent={renderEventContent}
                eventChange={eventChange}

                selectable={true}
                selectMirror={true}
                select={onNewEvent}
            />
        </div>
    )
}

export default CalendarFullView