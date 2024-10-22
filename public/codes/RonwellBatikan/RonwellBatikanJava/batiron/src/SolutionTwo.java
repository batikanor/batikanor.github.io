import java.time.DayOfWeek;
import java.time.Month;
import java.time.Year;
public class SolutionTwo {

    public int solution(int Y, String A, String B, String W) {
        int remainingTime = 0;
        A = A.toUpperCase();
        B = B.toUpperCase();
        W = W.toUpperCase();
        int index = Month.valueOf(B).compareTo(Month.valueOf(A));
        int s = Month.valueOf(B).getValue();
        while(index-- >= 0) {
            remainingTime += Month.of(s + index).length(Year.isLeap(Y));
        }
        index = Month.of(1).compareTo(Month.valueOf(A));
        int startDayIndex = 0;
        while(index-- >= 0) {
            startDayIndex += Month.of(1 + index).length(Year.isLeap(Y));
        }
        int startDay = DayOfWeek.valueOf(W).getValue();
        while(startDayIndex-- > 0) {
            startDay = (startDay + 1) % 7;
        }
        int flightWait = DayOfWeek.of(startDay).compareTo(DayOfWeek.of(1));
        remainingTime += flightWait;
        remainingTime -= 7;
        remainingTime -= startDay;
        return remainingTime / 7;
    }

}

