import java.util.Arrays;


// public class Node {
//     Node connection;
//     int val;
// }
// public class NodeGraph {
//     Vector<Node> nodes;
//     Node startNote;
// }
public class SolutionThree {



    /**
     * Checks if a path consisting of DIRECT CONNECTIONS exists to N that goes through ALL THE VERTICES in increasing order
     * @param N
     * @param A
     * @param B
     * @return
     */
    public boolean solution(int N, int[] A, int[] B) {
        // length of both graphs equal, M
        int M = A.length;


        // boolean array
        // if 1 is connected to 2, connected[1] is true.
        boolean connected[] = new boolean[N];
        Arrays.fill(connected, Boolean.FALSE);
        connected[0] = true;




  
        // traversing edges
        for (int i = 0; i < M; i++){
            int a = A[i];
            int b = B[i];
            if (Math.abs(a - b) == 1){
                int c = Math.min(a, b);
                if (c < N){
                    connected[Math.min(a, b)] = true;
                }
                
            }

        }

        for (int i = 0; i < N; i ++){
            if (connected[i] == false){
                return false;
            }
        }
        return true;
    } 
}
