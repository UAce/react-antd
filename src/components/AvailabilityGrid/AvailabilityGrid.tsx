import React, { useState } from "react";
import styled from "styled-components";

import addMinutes from "date-fns/add_minutes";
import addHours from "date-fns/add_hours";
import addDays from "date-fns/add_days";
import startOfDay from "date-fns/start_of_day";
import isSameMinute from "date-fns/is_same_minute";
import formatDate from "date-fns/format";

import SquareSelection from "./SquareSelection/SquareSelection";

const Wrapper = styled.div`
    display: flex;
    align-items: center;
    width: 100%;
    user-select: none;
`;

const Grid = styled.div<{ columns: number; rows: number; columnGap: string; rowGap: string }>`
    display: grid;
    grid-template-columns: auto repeat(${(props) => props.columns}, 1fr);
    grid-template-rows: auto repeat(${(props) => props.rows}, 1fr);
    column-gap: ${(props) => props.columnGap};
    row-gap: ${(props) => props.rowGap};
    width: 100%;
`;

export const GridCell = styled.div`
    place-self: stretch;
    touch-action: none;
`;

const DateCell = styled.div<{
    selected: boolean;
    selectedColor: string;
    unselectedColor: string;
    hoveredColor: string;
}>`
    width: 100%;
    height: 25px;
    background-color: ${(props) => (props.selected ? props.selectedColor : props.unselectedColor)};
    &:hover {
        background-color: ${(props) => props.hoveredColor};
    }
`;

const colors = {
    blue: "rgba(89, 154, 242, 1)",
    lightBlue: "rgba(162, 198, 248, 1)",
    white: "rgba(255, 255, 255, 1)",
    black: "rgba(79, 79, 79, 1)",
    grey: "rgba(79, 79, 79, 0.87)",
    paleBlue: "#dbedff"
};

export const Subtitle = styled.h2<{ align?: string }>`
    font-size: 20px;
    font-weight: 400;
    color: ${colors.black};
    text-align: ${(props) => props.align || "center"};
    @media (max-width: 700px) {
        font-size: 18px;
    }
`;

export const Text = styled.p`
    font-size: 14px;
    font-weight: 300;
    line-height: ${14 * 1.37}px;
    color: ${colors.grey};
    margin: 5px 0;
`;

const DateLabel = styled(Subtitle)`
    @media (max-width: 699px) {
        font-size: 12px;
    }
    margin: 0;
    margin-bottom: 4px;
`;

const TimeText = styled(Text)`
    @media (max-width: 699px) {
        font-size: 10px;
    }
    text-align: right;
    margin: 0;
    margin-right: 4px;
`;

interface AvailabilityGridProps {
    selection?: Array<Date>;
    onChange?: (newSelection: Array<Date>) => void;
    startDate?: Date;
    numDays?: number;
    minTime?: number;
    maxTime?: number;
    hourlyChunks?: number;
    dateFormat?: string;
    timeFormat?: string;
    columnGap?: string;
    rowGap?: string;
    unselectedColor?: string;
    selectedColor?: string;
    hoveredColor?: string;
    renderDateCell?: (
        datetime: Date,
        selected: boolean,
        refSetter?: (dateCellElement: HTMLElement) => void
    ) => JSX.Element;
    renderTimeLabel?: (time: Date) => JSX.Element;
    renderDateLabel?: (date: Date) => JSX.Element;
}

const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
    selection = [],
    onChange = () => {},
    startDate = new Date(),
    numDays = 7,
    minTime = 9,
    maxTime = 23,
    hourlyChunks = 1,
    dateFormat = "M/D",
    timeFormat = "ha",
    columnGap = "4px",
    rowGap = "4px",
    selectedColor = "rgba(89, 154, 242, 1)",
    unselectedColor = "#dbedff",
    hoveredColor = "rgba(162, 198, 248, 1)",
    renderDateCell: propsRenderDateCell,
    renderTimeLabel: propsRenderTimeLabel,
    renderDateLabel: propsRenderDateLabel
}) => {
    const [selectionScheme, setSelectionScheme] = useState<string>("square");
    const [selectionDraft, setSelectionDraft] = useState<Date[]>([]); // pre-committed selection
    const [selectionAction, setSelectionAction] = useState<string | null>(null); // add or remove
    const [selectionStart, setSelectionStart] = useState<Date | null>(null);
    const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
    const [dates, setDates] = useState<Date[][]>([[new Date()]]);
    const cellToDate: Map<Element, Date> = new Map();
    let gridRef: HTMLElement | null = null;

    const endSelection = () => {
        onChange(selectionDraft);
        setSelectionAction(null);
        setSelectionStart(null);
    };
    const updateAvailabilityDraft = (selectionEnd: Date | null, callback?: () => void) => {
        if (selectionAction === null || selectionStart === null) return;

        let newSelection: Array<Date> = [];
        if (selectionStart && selectionEnd && selectionAction) {
            newSelection = SquareSelection(selectionStart, selectionEnd, dates);
        }

        let nextDraft = [...selection];
        if (selectionAction === "add") {
            nextDraft = Array.from(new Set([...nextDraft, ...newSelection]));
        } else if (selectionAction === "remove") {
            nextDraft = nextDraft.filter((a) => !newSelection.find((b) => isSameMinute(a, b)));
        }

        // setState({ selectionDraft: nextDraft }, callback);
        setSelectionDraft(nextDraft);
    };
    const getTimeFromTouchEvent = (event: React.TouchEvent<any>): Date | null => {
        const { touches } = event;
        if (!touches || touches.length === 0) return null;
        const { clientX, clientY } = touches[0];
        const targetElement = document.elementFromPoint(clientX, clientY);
        if (targetElement) {
            const cellTime = cellToDate.get(targetElement);
            return cellTime ?? null;
        }
        return null;
    };
    const handleMouseEnterEvent = (time: Date) => {
        // Need to update selection draft on mouseup as well in order to catch the cases
        // where the user just clicks on a single cell (because no mouseenter events fire
        // in this scenario)
        updateAvailabilityDraft(time);
    };

    const handleMouseUpEvent = (time: Date) => {
        updateAvailabilityDraft(time);
        // Don't call endSelection() here because the document mouseup handler will do it
    };

    const handleTouchMoveEvent = (event: React.TouchEvent) => {
        setIsTouchDragging(true);
        const cellTime = getTimeFromTouchEvent(event);
        if (cellTime) {
            updateAvailabilityDraft(cellTime);
        }
    };

    const handleTouchEndEvent = () => {
        if (!isTouchDragging) {
            // Going down this branch means the user tapped but didn't drag -- which
            // means the availability draft hasn't yet been updated (since
            // handleTouchMoveEvent was never called) so we need to do it now
            updateAvailabilityDraft(null, () => {
                endSelection();
            });
        } else {
            endSelection();
        }
        setIsTouchDragging(false);
    };

    const renderDateCellWrapper = (time: Date): JSX.Element => {
        const startHandler = () => {
            handleSelectionStartEvent(time);
        };

        const selected = Boolean(selectionDraft.find((a) => isSameMinute(a, time)));

        return (
            <GridCell
                className="rgdp__grid-cell"
                role="presentation"
                key={time.toISOString()}
                // Mouse handlers
                onMouseDown={startHandler}
                onMouseEnter={() => {
                    handleMouseEnterEvent(time);
                }}
                onMouseUp={() => {
                    handleMouseUpEvent(time);
                }}
                // Touch handlers
                // Since touch events fire on the event where the touch-drag started, there's no point in passing
                // in the time parameter, instead these handlers will do their job using the default Event
                // parameters
                onTouchStart={startHandler}
                onTouchMove={handleTouchMoveEvent}
                onTouchEnd={handleTouchEndEvent}
            >
                {renderDateCell(time, selected)}
            </GridCell>
        );
    };

    const renderDateCell = (time: Date, selected: boolean): JSX.Element => {
        const refSetter = (dateCell: HTMLElement | null) => {
            if (dateCell) {
                cellToDate.set(dateCell, time);
            }
        };
        if (propsRenderDateCell) {
            return propsRenderDateCell(time, selected, refSetter);
        } else {
            return (
                <DateCell
                    selected={selected}
                    ref={refSetter}
                    selectedColor={selectedColor}
                    unselectedColor={unselectedColor}
                    hoveredColor={hoveredColor}
                />
            );
        }
    };

    const renderFullDateGrid = (): Array<JSX.Element> => {
        const flattenedDates: Date[] = [];
        const numDays = dates.length;
        const numTimes = dates[0].length;
        for (let j = 0; j < numTimes; j += 1) {
            for (let i = 0; i < numDays; i += 1) {
                flattenedDates.push(dates[i][j]);
            }
        }
        const dateGridElements = flattenedDates.map(renderDateCellWrapper);
        for (let i = 0; i < numTimes; i += 1) {
            const index = i * numDays;
            const time = dates[0][i];
            // Inject the time label at the start of every row
            dateGridElements.splice(index + i, 0, renderTimeLabel(time));
        }
        return [
            // Empty top left corner
            <div key="topleft" />,
            // Top row of dates
            ...dates.map((dayOfTimes, index) =>
                React.cloneElement(renderDateLabel(dayOfTimes[0]), { key: `date-${index}` })
            ),
            // Every row after that
            ...dateGridElements.map((element, index) => React.cloneElement(element, { key: `time-${index}` }))
        ];
    };

    const renderTimeLabel = (time: Date): JSX.Element => {
        if (propsRenderTimeLabel) {
            return propsRenderTimeLabel(time);
        } else {
            return <TimeText>{formatDate(time, timeFormat)}</TimeText>;
        }
    };

    const renderDateLabel = (date: Date): JSX.Element => {
        if (propsRenderDateLabel) {
            return propsRenderDateLabel(date);
        } else {
            return <DateLabel>{formatDate(date, dateFormat)}</DateLabel>;
        }
    };

    const handleSelectionStartEvent = (startTime: Date) => {
        // Check if the startTime cell is selected/unselected to determine if this drag-select should
        // add values or remove values
        const timeSelected = selection.find((date: Date) => isSameMinute(date, startTime));
        setSelectionAction(timeSelected ? "remove" : "add");
        setSelectionStart(startTime);
    };
    return (
        <Wrapper>
            <Grid
                columns={dates.length}
                rows={dates[0].length}
                columnGap={columnGap}
                rowGap={rowGap}
                ref={(el) => {
                    gridRef = el;
                }}
            >
                {renderFullDateGrid()}
            </Grid>
        </Wrapper>
    );
};

export default AvailabilityGrid;
